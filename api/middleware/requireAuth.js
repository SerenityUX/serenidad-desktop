module.exports = function createRequireAuth(pool) {
  return async function requireAuth(req, res, next) {
    const raw = req.headers.authorization || "";
    const token = raw.startsWith("Bearer ")
      ? raw.slice(7).trim()
      : raw.trim();

    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const r = await pool.query(
        `SELECT id, name, email, profile_picture, created_at
         FROM users WHERE token = $1`,
        [token],
      );
      if (r.rows.length === 0) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      req.user = r.rows[0];
      next();
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Auth failed" });
    }
  };
};
