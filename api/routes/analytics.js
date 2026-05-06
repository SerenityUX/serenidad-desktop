/**
 * Admin-only analytics surface. Mounted under /analytics.
 *
 * MRR is derived from users.role: webhook handlers in billing.js write
 * 'starter' | 'creator' | 'studio' onto the user when a Stripe subscription
 * is active, and revert to 'user' on cancellation. Multiplying head-counts
 * by tier price gives a live MRR estimate without a separate subscriptions
 * table.
 */
const express = require("express");

// Keep in sync with SUBSCRIPTION_TOKENS in lib/stripeClient.js — these are
// the monthly recurring USD amounts behind each tier.
const TIER_MONTHLY_USD = {
  starter: 10,
  creator: 30,
  studio: 150,
};

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

module.exports = function createAnalyticsRouter(pool, requireAuth) {
  const router = express.Router();
  router.use(requireAuth, requireAdmin);

  // Summary tile: total users, MRR (cents), generations count.
  router.get("/summary", async (_req, res) => {
    try {
      const [{ rows: usersRows }, { rows: mrrRows }, { rows: genRows }] =
        await Promise.all([
          pool.query(`SELECT COUNT(*)::int AS total FROM users WHERE pending_signup = FALSE`),
          pool.query(
            `SELECT role, COUNT(*)::int AS n FROM users
             WHERE role IN ('starter','creator','studio')
             GROUP BY role`,
          ),
          pool.query(
            `SELECT COUNT(*)::int AS total FROM frames WHERE result IS NOT NULL`,
          ),
        ]);
      let mrrCents = 0;
      const tierBreakdown = { starter: 0, creator: 0, studio: 0 };
      for (const row of mrrRows) {
        const n = row.n;
        tierBreakdown[row.role] = n;
        mrrCents += n * (TIER_MONTHLY_USD[row.role] || 0) * 100;
      }
      res.json({
        totalUsers: usersRows[0]?.total ?? 0,
        mrrCents,
        mrrUsd: mrrCents / 100,
        tierBreakdown,
        totalGenerations: genRows[0]?.total ?? 0,
      });
    } catch (e) {
      console.error("[analytics/summary]", e);
      res.status(500).json({ error: "Could not load summary" });
    }
  });

  // DAU over the last `days` days (default 30). Rows are ordered ascending
  // by date and zero-filled so the chart can render straight from the data.
  router.get("/dau", async (req, res) => {
    const days = Math.max(1, Math.min(365, Number(req.query.days) || 30));
    try {
      const r = await pool.query(
        `WITH days AS (
           SELECT generate_series(
             (now() AT TIME ZONE 'UTC')::date - ($1 - 1) * INTERVAL '1 day',
             (now() AT TIME ZONE 'UTC')::date,
             INTERVAL '1 day'
           )::date AS day
         )
         SELECT
           d.day::text AS day,
           COALESCE(COUNT(DISTINCT l.user_id), 0)::int AS dau
         FROM days d
         LEFT JOIN api_logs l
           ON (l.created_at AT TIME ZONE 'UTC')::date = d.day
           AND l.user_id IS NOT NULL
         GROUP BY d.day
         ORDER BY d.day ASC`,
        [days],
      );
      res.json({ days, points: r.rows });
    } catch (e) {
      console.error("[analytics/dau]", e);
      res.status(500).json({ error: "Could not load DAU" });
    }
  });

  // List users with activity stats so admin can scan and email people.
  router.get("/users", async (req, res) => {
    const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 100));
    try {
      const r = await pool.query(
        `SELECT
           u.id, u.name, u.email, u.profile_picture, u.role, u.tokens,
           u.created_at,
           (SELECT MAX(created_at) FROM api_logs WHERE user_id = u.id) AS last_seen,
           (SELECT COUNT(*)::int FROM frames f
              JOIN projects p ON p.id = f.project_id
              WHERE p.owner_id = u.id AND f.result IS NOT NULL) AS generations
         FROM users u
         WHERE u.pending_signup = FALSE
         ORDER BY u.created_at DESC
         LIMIT $1`,
        [limit],
      );
      res.json({ users: r.rows });
    } catch (e) {
      console.error("[analytics/users]", e);
      res.status(500).json({ error: "Could not load users" });
    }
  });

  // Recent generations feed.
  router.get("/generations", async (req, res) => {
    const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 100));
    try {
      const r = await pool.query(
        `SELECT
           f.id, f.prompt, f.result, f.model, f.created_at,
           p.id AS project_id, p.name AS project_name,
           u.id AS user_id, u.name AS user_name, u.email AS user_email
         FROM frames f
         JOIN projects p ON p.id = f.project_id
         JOIN users u ON u.id = p.owner_id
         WHERE f.result IS NOT NULL
         ORDER BY f.created_at DESC
         LIMIT $1`,
        [limit],
      );
      res.json({ generations: r.rows });
    } catch (e) {
      console.error("[analytics/generations]", e);
      res.status(500).json({ error: "Could not load generations" });
    }
  });

  // List a single user's projects so admin can drill in from the users table.
  router.get("/users/:id/projects", async (req, res) => {
    const userId = String(req.params.id || "").trim();
    if (!userId) return res.status(400).json({ error: "userId required" });
    try {
      const r = await pool.query(
        `SELECT p.id, p.name, p.thumbnail, p.width, p.height,
                p.created_at, p.frame_ids,
                COALESCE(array_length(p.frame_ids, 1), 0) AS frame_count
         FROM projects p
         WHERE p.owner_id = $1
         ORDER BY p.created_at DESC, p.id DESC`,
        [userId],
      );
      res.json({ projects: r.rows });
    } catch (e) {
      console.error("[analytics/users/projects]", e);
      res.status(500).json({ error: "Could not load projects" });
    }
  });

  // Admin-only token grant. Inserts a positive `transactions` row; the
  // existing trigger (migration 007) keeps users.tokens in sync.
  router.post("/grant", express.json(), async (req, res) => {
    const userId = String(req.body?.userId || "").trim();
    const amount = Number(req.body?.amount);
    const note = String(req.body?.note || "").slice(0, 500);
    if (!userId) return res.status(400).json({ error: "userId required" });
    if (userId === req.user.id) {
      return res.status(400).json({ error: "Cannot grant to yourself" });
    }
    if (!Number.isFinite(amount) || amount === 0 || !Number.isInteger(amount)) {
      return res.status(400).json({ error: "amount must be a non-zero integer" });
    }
    if (Math.abs(amount) > 1_000_000) {
      return res.status(400).json({ error: "amount out of range" });
    }
    try {
      const u = await pool.query(`SELECT id FROM users WHERE id = $1`, [userId]);
      if (u.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      await pool.query(
        `INSERT INTO transactions (user_id, delta, name, notes)
         VALUES ($1, $2, $3, $4)`,
        [userId, amount, "Admin grant", note || `Granted by ${req.user.email}`],
      );
      const bal = await pool.query(`SELECT tokens FROM users WHERE id = $1`, [userId]);
      res.json({ ok: true, tokens: bal.rows[0]?.tokens ?? 0 });
    } catch (e) {
      console.error("[analytics/grant]", e);
      res.status(500).json({ error: "Could not apply grant" });
    }
  });

  return router;
};
