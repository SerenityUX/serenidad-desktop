const express = require("express");
const { subscribe, maybeGc } = require("../lib/realtime");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (s) => typeof s === "string" && UUID_RE.test(s);

// Browser EventSource can't set Authorization headers, so SSE accepts the
// token via ?token= query param. Same token table as Bearer auth.
async function authFromQueryOrHeader(pool, req) {
  const headerToken = (() => {
    const raw = req.headers.authorization || "";
    return raw.startsWith("Bearer ") ? raw.slice(7).trim() : raw.trim();
  })();
  const token = headerToken || String(req.query.token || "").trim();
  if (!token) return null;
  const r = await pool.query(
    `SELECT id, name, email, role FROM users WHERE token = $1`,
    [token],
  );
  return r.rows[0] || null;
}

async function projectAccessible(pool, projectId, user) {
  const r = await pool.query(
    `SELECT 1 FROM projects p
     WHERE p.id = $1
       AND ($3
         OR p.owner_id = $2
         OR EXISTS (SELECT 1 FROM invites i WHERE i.project_id = p.id AND i.sent_to = $2))`,
    [projectId, user.id, user.role === "admin"],
  );
  return r.rowCount > 0;
}

module.exports = function createRealtimeRouter(pool) {
  const router = express.Router();

  router.get("/projects/:projectId/stream", async (req, res) => {
    const { projectId } = req.params;
    if (!isUuid(projectId)) return res.status(400).end();

    const user = await authFromQueryOrHeader(pool, req);
    if (!user) return res.status(401).end();
    if (!(await projectAccessible(pool, projectId, user))) {
      return res.status(404).end();
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    // Disable proxy buffering (Traefik/nginx) so events flush immediately.
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();
    res.write(`retry: 3000\n\n`);

    const since = req.query.since;
    let unsubscribe = () => {};
    try {
      unsubscribe = await subscribe(pool, projectId, res, since);
    } catch (err) {
      console.error("[realtime] subscribe failed:", err);
      try {
        res.write(`event: error\ndata: ${JSON.stringify({ message: "subscribe failed" })}\n\n`);
      } catch {}
      res.end();
      return;
    }

    const heartbeat = setInterval(() => {
      try {
        res.write(`: ping\n\n`);
      } catch {}
    }, 25000);

    const cleanup = () => {
      clearInterval(heartbeat);
      try {
        unsubscribe();
      } catch {}
      try {
        res.end();
      } catch {}
    };
    req.on("close", cleanup);
    req.on("error", cleanup);

    maybeGc(pool);
  });

  return router;
};
