/**
 * Lightweight smoke test for the chat + characters routers. Runs without a
 * real database — uses a stub pool whose `query` returns canned rows. Boots
 * the routers on an ephemeral port and exercises the auth + validation paths.
 *
 * Usage: node scripts/test-chat-characters.js
 */

const express = require("express");
const assert = require("assert");
const createChatRouter = require("../routes/chat");
const createCharactersRouter = require("../routes/characters");

const VALID_UUID = "11111111-1111-1111-1111-111111111111";
const OTHER_UUID = "22222222-2222-2222-2222-222222222222";
const TOKEN = "test-token";

function makeStubPool({ projectAccessible = true } = {}) {
  const calls = [];
  return {
    calls,
    async query(text, params = []) {
      calls.push({ text, params });
      const t = String(text);

      // requireAuth lookup
      if (/FROM users WHERE token/.test(t)) {
        return {
          rows: [
            {
              id: VALID_UUID,
              name: "Test User",
              email: "test@example.com",
              profile_picture: null,
              tokens: 100,
              role: "user",
              created_at: new Date().toISOString(),
            },
          ],
        };
      }

      // Project access check
      if (/FROM projects p[\s\S]*WHERE p\.id = \$1/.test(t)) {
        return projectAccessible
          ? { rows: [{ id: params[0], name: "Demo", owner_id: VALID_UUID }] }
          : { rows: [] };
      }

      // ensureChat lookup
      if (/SELECT id FROM chats WHERE project_id/.test(t)) {
        return { rows: [{ id: "33333333-3333-3333-3333-333333333333" }] };
      }

      // List chat messages
      if (/FROM chat_messages m/.test(t) && /ORDER BY/.test(t)) {
        return { rows: [] };
      }

      // List characters
      if (/FROM characters/.test(t) && /ORDER BY/.test(t)) {
        return { rows: [] };
      }

      return { rows: [] };
    },
  };
}

function makeRequireAuth(pool) {
  return require("../middleware/requireAuth")(pool);
}

async function startServer({ projectAccessible = true } = {}) {
  const pool = makeStubPool({ projectAccessible });
  const app = express();
  app.use(express.json());
  const requireAuth = makeRequireAuth(pool);
  app.use("/chat", createChatRouter(pool, requireAuth));
  app.use("/characters", createCharactersRouter(pool, requireAuth));
  return await new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      resolve({ pool, server, base: `http://127.0.0.1:${port}` });
    });
  });
}

async function run() {
  const results = [];
  const test = async (name, fn) => {
    try {
      await fn();
      results.push({ name, ok: true });
      console.log(`  ✓ ${name}`);
    } catch (e) {
      results.push({ name, ok: false, error: e });
      console.error(`  ✗ ${name}\n    ${e.message}`);
    }
  };

  console.log("chat + characters routers:");

  // 1. Unauthenticated requests rejected.
  {
    const { server, base } = await startServer();
    await test("GET /chat/projects/:id/messages without auth → 401", async () => {
      const r = await fetch(`${base}/chat/projects/${VALID_UUID}/messages`);
      assert.strictEqual(r.status, 401);
    });
    await test("GET /characters/projects/:id/characters without auth → 401", async () => {
      const r = await fetch(`${base}/characters/projects/${VALID_UUID}/characters`);
      assert.strictEqual(r.status, 401);
    });
    server.close();
  }

  // 2. Invalid UUID rejected with 400.
  {
    const { server, base } = await startServer();
    await test("GET /chat with bad UUID → 400", async () => {
      const r = await fetch(`${base}/chat/projects/not-a-uuid/messages`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      assert.strictEqual(r.status, 400);
    });
    await test("GET /characters with bad UUID → 400", async () => {
      const r = await fetch(`${base}/characters/projects/not-a-uuid/characters`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      assert.strictEqual(r.status, 400);
    });
    server.close();
  }

  // 3. 404 when user has no project access.
  {
    const { server, base } = await startServer({ projectAccessible: false });
    await test("GET /chat with no project access → 404", async () => {
      const r = await fetch(`${base}/chat/projects/${OTHER_UUID}/messages`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      assert.strictEqual(r.status, 404);
    });
    await test("POST /characters with no project access → 404", async () => {
      const r = await fetch(`${base}/characters/projects/${OTHER_UUID}/characters`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Aiko" }),
      });
      assert.strictEqual(r.status, 404);
    });
    server.close();
  }

  // 4. Authenticated list returns shape we expect.
  {
    const { server, base } = await startServer();
    await test("GET /chat messages returns chatId + messages", async () => {
      const r = await fetch(`${base}/chat/projects/${VALID_UUID}/messages`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      assert.strictEqual(r.status, 200);
      const data = await r.json();
      assert.ok(typeof data.chatId === "string");
      assert.ok(Array.isArray(data.messages));
    });
    await test("GET /characters returns characters array", async () => {
      const r = await fetch(`${base}/characters/projects/${VALID_UUID}/characters`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      assert.strictEqual(r.status, 200);
      const data = await r.json();
      assert.ok(Array.isArray(data.characters));
    });
    await test("POST /characters without name → 400", async () => {
      const r = await fetch(`${base}/characters/projects/${VALID_UUID}/characters`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      assert.strictEqual(r.status, 400);
    });
    await test("POST /chat message without text or attachments → 400", async () => {
      const r = await fetch(`${base}/chat/projects/${VALID_UUID}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      assert.strictEqual(r.status, 400);
    });
    server.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} tests passed`);
  if (failed.length) process.exit(1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
