// Realtime fan-out for project edits.
//
// One dedicated pg client runs LISTEN cocreate_changes for the whole API
// process. Mutations call emit(pool, projectId, kind, payload, opts) which
// inserts a row into project_events and pg_notifies a tiny envelope
// {projectId, seq, kind}. The LISTEN handler looks up the in-memory
// subscriber set for that project and pushes an SSE frame to each.
//
// Why this shape:
// - Postgres NOTIFY payload is capped at ~8KB, so the notify carries only
//   {seq, kind}; full payload always lives in project_events. Clients that
//   reconnect with ?since=<seq> replay missed rows from there. This is the
//   single thing that makes the system reliable without polling.
// - One LISTEN connection (not per-project) keeps Postgres connection count
//   low on the Coolify server. Subscriber maps live in process memory.
// - Heartbeats and GC are owned by the SSE route, not this module.

const { Pool } = require("pg");
const { pgSslOption } = require("../db/pool");

const CHANNEL = "cocreate_changes";

const subscribers = new Map(); // projectId -> Set<sseRes>
let listenClient = null;
let listenReady = null; // Promise

function connectionConfig() {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL, ssl: pgSslOption() };
  }
  return {
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    ssl: pgSslOption(),
  };
}

async function ensureListener(pool) {
  if (listenReady) return listenReady;
  listenReady = (async () => {
    // Use a tiny dedicated Pool of size 1 so we don't fight the main pool.
    const lp = new Pool({ ...connectionConfig(), max: 1 });
    const client = await lp.connect();
    listenClient = client;
    client.on("notification", (msg) => {
      if (msg.channel !== CHANNEL || !msg.payload) return;
      let env;
      try {
        env = JSON.parse(msg.payload);
      } catch {
        return;
      }
      const set = subscribers.get(env.projectId);
      if (!set || set.size === 0) return;
      // Replay full row from project_events so peers see the same payload as
      // a reconnecting client (single source of truth = the table).
      pool
        .query(
          `SELECT id, project_id, actor_id, source, kind, payload, inverse, created_at
           FROM project_events WHERE id = $1`,
          [env.seq],
        )
        .then((r) => {
          const row = r.rows[0];
          if (!row) return;
          const frame = serializeEvent(row);
          for (const res of set) {
            try {
              res.write(frame);
            } catch {
              // socket gone — cleanup happens via 'close' on the res
            }
          }
        })
        .catch(() => {});
    });
    client.on("error", () => {
      // Connection died — drop and let next emit/subscribe re-establish.
      listenClient = null;
      listenReady = null;
      try {
        client.release(true);
      } catch {}
      try {
        lp.end();
      } catch {}
    });
    await client.query(`LISTEN ${CHANNEL}`);
    return client;
  })().catch((err) => {
    listenReady = null;
    throw err;
  });
  return listenReady;
}

function serializeEvent(row) {
  const data = {
    seq: Number(row.id),
    kind: row.kind,
    payload: row.payload,
    inverse: row.inverse,
    actorId: row.actor_id,
    source: row.source,
    createdAt: row.created_at,
  };
  return `id: ${data.seq}\nevent: change\ndata: ${JSON.stringify(data)}\n\n`;
}

async function subscribe(pool, projectId, res, since) {
  await ensureListener(pool);

  // Replay missed events since the last seq the client saw.
  //
  // `chat.agent_step` events (tool_pending / tool_progress / delta / paused
  // / done) are deliberately filtered out of replay: they're transient
  // turn-state, not durable project state. A client that reconnects mid-run
  // rehydrates approval cards via GET /active-run instead. Replaying them
  // would resurrect long-dead approval lists from past chat turns and stack
  // dozens of stale tool_pending cards into the UI.
  if (since && Number.isFinite(Number(since))) {
    const r = await pool.query(
      `SELECT id, project_id, actor_id, source, kind, payload, inverse, created_at
       FROM project_events
       WHERE project_id = $1 AND id > $2 AND kind <> 'chat.agent_step'
       ORDER BY id ASC
       LIMIT 500`,
      [projectId, Number(since)],
    );
    for (const row of r.rows) {
      try {
        res.write(serializeEvent(row));
      } catch {
        return;
      }
    }
  }

  let set = subscribers.get(projectId);
  if (!set) {
    set = new Set();
    subscribers.set(projectId, set);
  }
  set.add(res);

  return () => {
    const s = subscribers.get(projectId);
    if (!s) return;
    s.delete(res);
    if (s.size === 0) subscribers.delete(projectId);
  };
}

/**
 * Persist an event to project_events and notify peers.
 * Returns the inserted row (so callers can include its seq in HTTP responses
 * and the client can dedupe its own optimistic update against the realtime
 * echo).
 */
async function emit(pool, projectId, kind, payload, opts = {}) {
  const actorId = opts.actorId || null;
  const source = opts.source || "user";
  const inverse = opts.inverse || null;
  const r = await pool.query(
    `INSERT INTO project_events (project_id, actor_id, source, kind, payload, inverse)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
     RETURNING id, project_id, actor_id, source, kind, payload, inverse, created_at`,
    [
      projectId,
      actorId,
      source,
      kind,
      JSON.stringify(payload || {}),
      inverse ? JSON.stringify(inverse) : null,
    ],
  );
  const row = r.rows[0];
  // Tiny envelope; full payload comes from the table on the listener side.
  await pool
    .query(`SELECT pg_notify($1, $2)`, [
      CHANNEL,
      JSON.stringify({ projectId, seq: Number(row.id), kind }),
    ])
    .catch(() => {});
  return row;
}

// Best-effort cleanup so the table doesn't grow forever. Called lazily from
// the SSE route, rate-limited to once/hour per process. 24h replay window is
// way more than any reasonable reconnect; older clients just full-refetch.
let lastGcAt = 0;
async function maybeGc(pool) {
  const now = Date.now();
  if (now - lastGcAt < 60 * 60 * 1000) return;
  lastGcAt = now;
  pool
    .query(
      `DELETE FROM project_events WHERE created_at < NOW() - INTERVAL '24 hours'`,
    )
    .catch(() => {});
}

module.exports = { subscribe, emit, maybeGc };
