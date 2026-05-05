/**
 * Per-request logger. Mounted AFTER requireAuth so we have req.user.
 * Inserts on `res.finish` so we capture status code and don't slow the
 * response. Failures are swallowed — analytics shouldn't break the API.
 */
module.exports = function createLogRequest(pool) {
  return function logRequest(req, res, next) {
    res.on("finish", () => {
      const userId = req.user?.id || null;
      // Strip query string + cap path length so the column stays sane.
      const path = String(req.originalUrl || req.url || "")
        .split("?")[0]
        .slice(0, 300);
      pool
        .query(
          `INSERT INTO api_logs (user_id, method, path, status)
           VALUES ($1, $2, $3, $4)`,
          [userId, req.method, path, res.statusCode],
        )
        .catch((e) => {
          console.warn("[api_logs] insert failed:", e.message);
        });
    });
    next();
  };
};
