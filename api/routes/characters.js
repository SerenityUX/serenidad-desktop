const express = require("express");
const { generateFalImage } = require("../lib/falImage");
const { isProbablyAssetUrl } = require("../lib/assetUrl");
const { resolveStyleSuffix } = require("../lib/styles");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (s) => typeof s === "string" && UUID_RE.test(s);

async function getProjectIfAccessible(pool, projectId, user) {
  const userId = typeof user === "string" ? user : user?.id;
  const isAdmin = typeof user === "object" && user?.role === "admin";
  const r = await pool.query(
    `SELECT p.id, p.name, p.owner_id, p.width, p.height, p.style
     FROM projects p
     WHERE p.id = $1
       AND (
         $3
         OR p.owner_id = $2
         OR EXISTS (
           SELECT 1 FROM invites i
           WHERE i.project_id = p.id AND i.sent_to = $2
         )
       )`,
    [projectId, userId, isAdmin],
  );
  return r.rows[0] || null;
}

module.exports = function createCharactersRouter(pool, requireAuth) {
  const router = express.Router();
  router.use(requireAuth);

  router.get("/projects/:projectId/characters", async (req, res) => {
    const { projectId } = req.params;
    if (!isUuid(projectId)) return res.status(400).json({ error: "Invalid id" });
    const proj = await getProjectIfAccessible(pool, projectId, req.user);
    if (!proj) return res.status(404).json({ error: "Project not found" });
    const r = await pool.query(
      `SELECT id, project_id, created_by, name, description, image_url, created_at
       FROM characters
       WHERE project_id = $1
       ORDER BY created_at ASC`,
      [projectId],
    );
    res.json({ characters: r.rows });
  });

  // Generate a character portrait (does not persist anything yet).
  router.post(
    "/projects/:projectId/characters/generate-image",
    async (req, res) => {
      const { projectId } = req.params;
      if (!isUuid(projectId))
        return res.status(400).json({ error: "Invalid id" });
      const proj = await getProjectIfAccessible(pool, projectId, req.user);
      if (!proj) return res.status(404).json({ error: "Project not found" });

      const name = String(req.body?.name || "").trim();
      const description = String(req.body?.description || "").trim();
      const modelId = req.body?.model
        ? String(req.body.model).trim()
        : undefined;
      if (!name && !description) {
        return res.status(400).json({ error: "name or description required" });
      }

      // Style suffix keeps character portraits visually consistent with the
      // rest of the storyboard. Same portrait doubles as: (a) the reference
      // image bound to scenes for character consistency at gen time, and (b)
      // the card art shown in CharactersView and chat cards.
      const styleSuffix = resolveStyleSuffix(proj.style);
      const prompt = [
        `Anime-style character portrait of ${name || "an original character"}.`,
        description,
        "Centered bust shot, clean neutral background, even lighting, full color, high detail, full face visible.",
        styleSuffix ? `${styleSuffix}.` : "",
      ]
        .filter(Boolean)
        .join(" ");

      try {
        const out = await generateFalImage({
          modelId,
          prompt,
          width: 768,
          height: 1024,
        });
        if (!isProbablyAssetUrl(out.url)) {
          return res
            .status(502)
            .json({ error: "Invalid image URL from provider" });
        }
        return res.json({ imageUrl: out.url });
      } catch (e) {
        console.error("[characters] image gen failed:", e);
        return res
          .status(502)
          .json({ error: String(e.message || "Image generation failed") });
      }
    },
  );

  router.post("/projects/:projectId/characters", async (req, res) => {
    const { projectId } = req.params;
    if (!isUuid(projectId)) return res.status(400).json({ error: "Invalid id" });
    const proj = await getProjectIfAccessible(pool, projectId, req.user);
    if (!proj) return res.status(404).json({ error: "Project not found" });
    const name = String(req.body?.name || "").trim();
    const description = String(req.body?.description || "").trim();
    const imageUrl = req.body?.imageUrl ? String(req.body.imageUrl).trim() : null;
    if (!name) return res.status(400).json({ error: "name is required" });

    const r = await pool.query(
      `INSERT INTO characters (project_id, created_by, name, description, image_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, project_id, created_by, name, description, image_url, created_at`,
      [projectId, req.user.id, name, description, imageUrl],
    );
    res.json({ character: r.rows[0] });
  });

  router.patch(
    "/projects/:projectId/characters/:characterId",
    async (req, res) => {
      const { projectId, characterId } = req.params;
      if (!isUuid(projectId) || !isUuid(characterId)) {
        return res.status(400).json({ error: "Invalid id" });
      }
      const proj = await getProjectIfAccessible(pool, projectId, req.user);
      if (!proj) return res.status(404).json({ error: "Project not found" });

      const sets = [];
      const vals = [];
      let pi = 1;
      if (typeof req.body?.name === "string") {
        const n = req.body.name.trim();
        if (!n) return res.status(400).json({ error: "name cannot be empty" });
        sets.push(`name = $${pi++}`);
        vals.push(n);
      }
      if (typeof req.body?.description === "string") {
        sets.push(`description = $${pi++}`);
        vals.push(req.body.description);
      }
      if (Object.prototype.hasOwnProperty.call(req.body || {}, "imageUrl")) {
        const url = req.body.imageUrl;
        if (url != null && url !== "" && !isProbablyAssetUrl(String(url))) {
          return res.status(400).json({ error: "imageUrl must be HTTP(S)" });
        }
        sets.push(`image_url = $${pi++}`);
        vals.push(url == null || url === "" ? null : String(url));
      }
      if (sets.length === 0) {
        return res.status(400).json({ error: "Nothing to update" });
      }
      vals.push(characterId, projectId);
      const u = await pool.query(
        `UPDATE characters SET ${sets.join(", ")}
          WHERE id = $${pi++} AND project_id = $${pi}
          RETURNING id, project_id, created_by, name, description, image_url, created_at`,
        vals,
      );
      if (u.rows.length === 0) {
        return res.status(404).json({ error: "Character not found" });
      }
      return res.json({ character: u.rows[0] });
    },
  );

  router.delete(
    "/projects/:projectId/characters/:characterId",
    async (req, res) => {
      const { projectId, characterId } = req.params;
      if (!isUuid(projectId) || !isUuid(characterId)) {
        return res.status(400).json({ error: "Invalid id" });
      }
      const proj = await getProjectIfAccessible(pool, projectId, req.user);
      if (!proj) return res.status(404).json({ error: "Project not found" });
      await pool.query(
        `DELETE FROM characters WHERE id = $1 AND project_id = $2`,
        [characterId, projectId],
      );
      res.json({ ok: true });
    },
  );

  return router;
};
