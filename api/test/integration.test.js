// End-to-end integration tests for the chat agent.
//
// Each test:
//   1. Spins up an isolated Postgres schema with the full migration set
//      applied (so DB constraints, including 018, are enforced).
//   2. Stubs OpenRouter and fal so we can drive the agent through specific
//      tool-call sequences without touching the network or spending tokens.
//   3. Boots the chat router on an ephemeral port and exercises HTTP routes
//      exactly as the real client would.
//
// Skipped if Postgres isn't reachable (so `npm test` doesn't hard-fail in
// environments that don't have a DB available — CI without a Postgres
// service is the obvious case).

const test = require("node:test");
const assert = require("node:assert");
const express = require("express");

// IMPORTANT: stub fal BEFORE requiring the chat router, so its top-level
// `require('../lib/falImage')` resolves to the stub.
const stubs = require("./stubs");
stubs.stubFalImage();

const createChatRouter = require("../routes/chat");
const createRequireAuth = require("../middleware/requireAuth");
const { createIsolatedDb, seed, isReachable } = require("./db");

// All tests share a single isolated schema. node:test serializes test() calls
// within a file by default, so concurrent state isn't a worry — and we save
// the cost of re-running 18 migrations between tests.
let dbReachable = false;
let dbHandle;
let baseUrl;
let server;
let pool;
let auth;

test.before(async () => {
  // Required so the agent's callOpenRouter() finds a "queued" response.
  process.env.OPEN_ROUTER_API_TOKEN = process.env.OPEN_ROUTER_API_TOKEN || "test-key";
  stubs.installFetchStub();

  dbReachable = await isReachable();
  if (!dbReachable) return;

  dbHandle = await createIsolatedDb();
  pool = dbHandle.pool;
  auth = await seed(pool);

  const app = express();
  app.use(express.json());
  const requireAuth = createRequireAuth(pool);
  app.use("/chat", createChatRouter(pool, requireAuth));
  await new Promise((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
  stubs.uninstallFetchStub();
  if (server) await new Promise((r) => server.close(r));
  if (dbHandle) await dbHandle.dispose();
});

function authHeaders() {
  return {
    Authorization: `Bearer ${auth.token}`,
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
}

// Drains an SSE response into a flat array of {event, data} pairs. Lets a
// test assert "we saw tool_call followed by done with this payload" without
// reimplementing the parser everywhere.
async function readSse(res) {
  assert.strictEqual(res.status, 200, `expected 200, got ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const events = [];
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";
    for (const chunk of chunks) {
      let event = "message";
      let data = "";
      for (const line of chunk.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;
      try {
        events.push({ event, data: JSON.parse(data) });
      } catch {
        events.push({ event, data });
      }
    }
  }
  return events;
}

test("validation: rejects body missing message + attachments + contextRefs", async (t) => {
  if (!dbReachable) return t.skip("Postgres not reachable");
  const r = await fetch(`${baseUrl}/chat/projects/${auth.projectId}/messages`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({}),
  });
  assert.strictEqual(r.status, 400);
  const body = await r.json();
  assert.ok(Array.isArray(body.issues), "issues should be an array");
});

test("validation: rejects malformed projectId", async (t) => {
  if (!dbReachable) return t.skip("Postgres not reachable");
  const r = await fetch(`${baseUrl}/chat/projects/not-a-uuid/messages`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ message: "hi" }),
  });
  assert.strictEqual(r.status, 400);
});

test("agent: simple text reply persists assistant message", async (t) => {
  if (!dbReachable) return t.skip("Postgres not reachable");
  stubs.queueOpenRouterResponse({ content: "Hello there!" });
  const r = await fetch(`${baseUrl}/chat/projects/${auth.projectId}/messages`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ message: "hi" }),
  });
  const events = await readSse(r);
  const done = events.find((e) => e.event === "done");
  assert.ok(done, "should receive done event");
  assert.strictEqual(done.data.role, "assistant");
  assert.match(done.data.message_contents, /Hello/);

  const list = await fetch(`${baseUrl}/chat/projects/${auth.projectId}/messages`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  }).then((x) => x.json());
  // user + assistant
  assert.ok(list.messages.length >= 2);
  const last = list.messages[list.messages.length - 1];
  assert.strictEqual(last.role, "assistant");
});

test("agent: tool call (add_scene) executes and persists", async (t) => {
  if (!dbReachable) return t.skip("Postgres not reachable");
  // First turn: model emits add_scene.
  stubs.queueOpenRouterResponse({
    toolCalls: [{ name: "add_scene", args: { prompt: "A quiet street at dusk" } }],
  });
  // Second turn: model wraps up with text, no more tool calls.
  stubs.queueOpenRouterResponse({ content: "Added one scene." });

  const r = await fetch(`${baseUrl}/chat/projects/${auth.projectId}/messages`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ message: "make me a scene" }),
  });
  const events = await readSse(r);
  const toolEvent = events.find((e) => e.event === "tool_call");
  assert.ok(toolEvent, "should fire tool_call event");
  assert.strictEqual(toolEvent.data.name, "add_scene");
  assert.ok(toolEvent.data.result?.ok, "add_scene should succeed");

  const frames = await pool.query(
    `SELECT prompt FROM frames WHERE project_id = $1`,
    [auth.projectId],
  );
  assert.ok(frames.rows.some((f) => f.prompt === "A quiet street at dusk"));
});

test("DB constraint: duplicate character name is blocked at insert", async (t) => {
  if (!dbReachable) return t.skip("Postgres not reachable");
  await pool.query(
    `INSERT INTO characters (project_id, name, description) VALUES ($1, 'Hiroshi', 'first')`,
    [auth.projectId],
  );
  await assert.rejects(
    pool.query(
      `INSERT INTO characters (project_id, name, description) VALUES ($1, 'hiroshi', 'second')`,
      [auth.projectId],
    ),
    (err) => err.code === "23505", // unique_violation
  );
});

test("agent: create_character is idempotent on duplicate", async (t) => {
  if (!dbReachable) return t.skip("Postgres not reachable");
  stubs.queueOpenRouterResponse({
    toolCalls: [{ name: "create_character", args: { name: "Hiroshi", description: "again" } }],
  });
  stubs.queueOpenRouterResponse({ content: "ok" });

  const r = await fetch(`${baseUrl}/chat/projects/${auth.projectId}/messages`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ message: "add Hiroshi" }),
  });
  const events = await readSse(r);
  const tool = events.find((e) => e.event === "tool_call" && e.data.name === "create_character");
  assert.ok(tool, "should fire create_character tool_call");
  assert.ok(tool.data.result?.ok, "result should be ok, not error");
  assert.strictEqual(tool.data.result?.alreadyExisted, true);
});

test("agent: pause on generate_scene + resolve runs generation", async (t) => {
  if (!dbReachable) return t.skip("Postgres not reachable");
  // Add a scene first so generate_scene has a target.
  const f = await pool.query(
    `INSERT INTO frames (project_id, prompt) VALUES ($1, 'Test frame') RETURNING id`,
    [auth.projectId],
  );
  await pool.query(
    `UPDATE projects SET frame_ids = array_append(frame_ids, $2::uuid) WHERE id = $1`,
    [auth.projectId, f.rows[0].id],
  );
  // Find the new sceneIndex.
  const frames = await pool.query(
    `SELECT id FROM frames WHERE project_id = $1 ORDER BY created_at`,
    [auth.projectId],
  );
  const sceneIndex = frames.rows.findIndex((row) => row.id === f.rows[0].id) + 1;

  // Initial turn: agent proposes a generate_scene.
  stubs.queueOpenRouterResponse({
    toolCalls: [{ name: "generate_scene", args: { sceneIndex } }],
  });
  // Resume turn (after we approve): agent acknowledges with text.
  stubs.queueOpenRouterResponse({ content: "Generated." });

  const initial = await fetch(`${baseUrl}/chat/projects/${auth.projectId}/messages`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ message: "render scene" }),
  });
  const initEvents = await readSse(initial);
  const pendingEvent = initEvents.find((e) => e.event === "tool_pending");
  assert.ok(pendingEvent, "should pause with tool_pending event");
  const pausedEvent = initEvents.find((e) => e.event === "paused");
  assert.ok(pausedEvent, "should fire paused event");
  const runId = pausedEvent.data.runId;

  // Approve via /resolve.
  const beforeFalCount = stubs.falCalls();
  const resolveRes = await fetch(
    `${baseUrl}/chat/projects/${auth.projectId}/messages/runs/${runId}/resolve`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        decisions: [{ toolCallId: pendingEvent.data.tool_call_id, action: "approve" }],
      }),
    },
  );
  const resolveEvents = await readSse(resolveRes);
  assert.ok(stubs.falCalls() > beforeFalCount, "fal should have been called once");
  const toolDone = resolveEvents.find(
    (e) => e.event === "tool_call" && e.data.name === "generate_scene",
  );
  assert.ok(toolDone, "should report tool_call result");
  assert.strictEqual(toolDone.data.result?.ok, true);

  const after = await pool.query(
    `SELECT result FROM frames WHERE id = $1`,
    [f.rows[0].id],
  );
  assert.match(after.rows[0].result, /^https:\/\/test\.fal\//);
});

test("agent: cancel pending run prevents continuation", async (t) => {
  if (!dbReachable) return t.skip("Postgres not reachable");
  // Add target frame.
  const f = await pool.query(
    `INSERT INTO frames (project_id, prompt) VALUES ($1, 'Cancel target') RETURNING id`,
    [auth.projectId],
  );
  await pool.query(
    `UPDATE projects SET frame_ids = array_append(frame_ids, $2::uuid) WHERE id = $1`,
    [auth.projectId, f.rows[0].id],
  );
  const frames = await pool.query(
    `SELECT id FROM frames WHERE project_id = $1 ORDER BY created_at`,
    [auth.projectId],
  );
  const sceneIndex = frames.rows.findIndex((row) => row.id === f.rows[0].id) + 1;

  stubs.queueOpenRouterResponse({
    toolCalls: [{ name: "generate_scene", args: { sceneIndex } }],
  });

  const initial = await fetch(`${baseUrl}/chat/projects/${auth.projectId}/messages`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ message: "render this" }),
  });
  const events = await readSse(initial);
  const paused = events.find((e) => e.event === "paused");
  const runId = paused.data.runId;

  // Cancel.
  const cancelRes = await fetch(
    `${baseUrl}/chat/projects/${auth.projectId}/messages/runs/${runId}/cancel`,
    { method: "POST", headers: { Authorization: `Bearer ${auth.token}` } },
  );
  assert.strictEqual(cancelRes.status, 200);

  // Pending row should be gone.
  const remaining = await pool.query(
    `SELECT id FROM chat_pending_runs WHERE id = $1`,
    [runId],
  );
  assert.strictEqual(remaining.rows.length, 0);
});
