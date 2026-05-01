const express = require("express");
const { isProbablyAssetUrl } = require("../lib/assetUrl");

module.exports = function createProjectsRouter(pool, requireAuth) {
  const router = express.Router();
  router.use(requireAuth);

  router.get("/", async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT p.id,
                p.name,
                p.thumbnail,
                p.width,
                p.height,
                p.owner_id,
                p.frame_ids,
                p.created_at,
                CASE WHEN p.owner_id = $1 THEN 'owner' ELSE 'invited' END AS membership
         FROM projects p
         WHERE p.owner_id = $1
            OR EXISTS (
              SELECT 1 FROM invites i
              WHERE i.project_id = p.id AND i.sent_to = $1
            )
         ORDER BY p.created_at DESC, p.id DESC`,
        [req.user.id],
      );
      return res.json({ projects: r.rows });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Could not load projects" });
    }
  });

  router.post("/", async (req, res) => {
    const name = String(req.body?.name || "").trim();
    const thumbnailRaw =
      req.body?.thumbnail != null && req.body.thumbnail !== ""
        ? String(req.body.thumbnail).trim()
        : null;

    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    if (thumbnailRaw != null && !isProbablyAssetUrl(thumbnailRaw)) {
      return res
        .status(400)
        .json({ error: "thumbnail must be an HTTP or HTTPS URL" });
    }

    let width = Number.parseInt(String(req.body?.width ?? ""), 10);
    let height = Number.parseInt(String(req.body?.height ?? ""), 10);
    if (!Number.isFinite(width) || width < 1) {
      width = 1920;
    }
    if (!Number.isFinite(height) || height < 1) {
      height = 1080;
    }

    try {
      const ins = await pool.query(
        `INSERT INTO projects (name, thumbnail, owner_id, width, height)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, thumbnail, width, height, owner_id, frame_ids, created_at`,
        [name, thumbnailRaw, req.user.id, width, height],
      );
      return res.status(201).json(ins.rows[0]);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Could not create project" });
    }
  });

  return router;
};
