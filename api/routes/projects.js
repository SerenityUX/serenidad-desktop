const express = require("express");
const { isProbablyAssetUrl } = require("../lib/assetUrl");
const { generateNanoBananaImage } = require("../lib/falNanoBanana");

const IMAGE_GEN_TOKEN_COST = 8;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(s) {
  return typeof s === "string" && UUID_RE.test(s);
}

async function getProjectIfAccessible(pool, projectId, userId) {
  const r = await pool.query(
    `SELECT p.id,
            p.name,
            p.thumbnail,
            p.width,
            p.height,
            p.owner_id,
            p.frame_ids,
            p.created_at,
            CASE WHEN p.owner_id = $2 THEN 'owner' ELSE 'invited' END AS membership
     FROM projects p
     WHERE p.id = $1
       AND (
         p.owner_id = $2
         OR EXISTS (
           SELECT 1 FROM invites i
           WHERE i.project_id = p.id AND i.sent_to = $2
         )
       )`,
    [projectId, userId],
  );
  return r.rows[0] || null;
}

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
      req.body?.thumbnail != null && req.body?.thumbnail !== ""
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
      width = 1280;
    }
    if (!Number.isFinite(height) || height < 1) {
      height = 720;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const ins = await client.query(
        `INSERT INTO projects (name, thumbnail, owner_id, width, height)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, thumbnail, width, height, owner_id, frame_ids, created_at`,
        [name, thumbnailRaw, req.user.id, width, height],
      );
      const row = ins.rows[0];
      const f1 = await client.query(
        `INSERT INTO frames (project_id, prompt, result)
         VALUES ($1, '', NULL)
         RETURNING id`,
        [row.id],
      );
      const f2 = await client.query(
        `INSERT INTO frames (project_id, prompt, result)
         VALUES ($1, '', NULL)
         RETURNING id`,
        [row.id],
      );
      const frameIds = [f1.rows[0].id, f2.rows[0].id];
      await client.query(
        `UPDATE projects SET frame_ids = $2::uuid[] WHERE id = $1`,
        [row.id, frameIds],
      );
      await client.query("COMMIT");
      const out = { ...row, frame_ids: frameIds };
      return res.status(201).json(out);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error(e);
      return res.status(500).json({ error: "Could not create project" });
    } finally {
      client.release();
    }
  });

  router.patch("/:projectId/frames/:frameId", async (req, res) => {
    const { projectId, frameId } = req.params;
    if (!isUuid(projectId) || !isUuid(frameId)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const proj = await getProjectIfAccessible(pool, projectId, req.user.id);
    if (!proj) {
      return res.status(404).json({ error: "Project not found" });
    }
    const patch = req.body || {};
    const sets = [];
    const vals = [];
    let pi = 1;
    if (Object.prototype.hasOwnProperty.call(patch, "prompt")) {
      sets.push(`prompt = $${pi++}`);
      vals.push(patch.prompt == null ? "" : String(patch.prompt));
    }
    if (Object.prototype.hasOwnProperty.call(patch, "negative_prompt")) {
      sets.push(`negative_prompt = $${pi++}`);
      vals.push(
        patch.negative_prompt == null ? "" : String(patch.negative_prompt),
      );
    }
    if (Object.prototype.hasOwnProperty.call(patch, "result")) {
      const r = patch.result;
      if (r != null && r !== "" && !isProbablyAssetUrl(String(r))) {
        return res
          .status(400)
          .json({ error: "result must be an HTTP or HTTPS URL when set" });
      }
      sets.push(`result = $${pi++}`);
      vals.push(r == null || r === "" ? null : String(r));
    }
    if (Object.prototype.hasOwnProperty.call(patch, "meta")) {
      sets.push(`meta = COALESCE(meta, '{}'::jsonb) || $${pi++}::jsonb`);
      vals.push(JSON.stringify(patch.meta ?? {}));
    }
    if (sets.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }
    const idPh = pi++;
    const projPh = pi++;
    vals.push(frameId, projectId);
    try {
      const u = await pool.query(
        `UPDATE frames SET ${sets.join(", ")}
         WHERE id = $${idPh} AND project_id = $${projPh}
         RETURNING id, prompt, negative_prompt, result, meta, created_at`,
        vals,
      );
      if (u.rows.length === 0) {
        return res.status(404).json({ error: "Frame not found" });
      }
      return res.json({ frame: u.rows[0] });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Could not update frame" });
    }
  });

  router.post("/:projectId/frames/:frameId/generate-image", async (req, res) => {
    const { projectId, frameId } = req.params;
    if (!isUuid(projectId) || !isUuid(frameId)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const proj = await getProjectIfAccessible(pool, projectId, req.user.id);
    if (!proj) {
      return res.status(404).json({ error: "Project not found" });
    }
    const prompt = String(req.body?.prompt || "").trim();
    if (!prompt) {
      return res.status(400).json({ error: "prompt is required" });
    }

    const frameCheck = await pool.query(
      `SELECT id FROM frames WHERE id = $1 AND project_id = $2`,
      [frameId, projectId],
    );
    if (frameCheck.rows.length === 0) {
      return res.status(404).json({ error: "Frame not found" });
    }

    const debitClient = await pool.connect();
    try {
      await debitClient.query("BEGIN");
      const bal = await debitClient.query(
        `SELECT tokens FROM users WHERE id = $1 FOR UPDATE`,
        [req.user.id],
      );
      const current = bal.rows[0]?.tokens ?? 0;
      if (current < IMAGE_GEN_TOKEN_COST) {
        await debitClient.query("ROLLBACK");
        return res.status(402).json({
          error: "Insufficient tokens",
          tokens: current,
          required: IMAGE_GEN_TOKEN_COST,
        });
      }
      await debitClient.query(
        `INSERT INTO transactions (user_id, delta, name, notes)
         VALUES ($1, $2, $3, $4)`,
        [
          req.user.id,
          -IMAGE_GEN_TOKEN_COST,
          "Image generation",
          `nano-banana-2 frame ${frameId}`,
        ],
      );
      await debitClient.query("COMMIT");
    } catch (e) {
      await debitClient.query("ROLLBACK").catch(() => {});
      debitClient.release();
      console.error(e);
      return res.status(500).json({ error: "Could not debit tokens" });
    }
    debitClient.release();

    let imageUrl;
    try {
      imageUrl = await generateNanoBananaImage({
        prompt,
        width: proj.width,
        height: proj.height,
      });
    } catch (falErr) {
      console.error(falErr);
      try {
        await pool.query(
          `INSERT INTO transactions (user_id, delta, name, notes)
           VALUES ($1, $2, $3, $4)`,
          [
            req.user.id,
            IMAGE_GEN_TOKEN_COST,
            "Refund",
            String(falErr.message || "fal generation failed").slice(0, 500),
          ],
        );
      } catch (refundErr) {
        console.error(refundErr);
      }
      return res.status(502).json({
        error: String(falErr.message || "Image generation failed"),
      });
    }

    if (!isProbablyAssetUrl(imageUrl)) {
      try {
        await pool.query(
          `INSERT INTO transactions (user_id, delta, name, notes)
           VALUES ($1, $2, $3, $4)`,
          [
            req.user.id,
            IMAGE_GEN_TOKEN_COST,
            "Refund",
            "Invalid image URL from provider",
          ],
        );
      } catch (refundErr) {
        console.error(refundErr);
      }
      return res.status(502).json({ error: "Invalid image URL from provider" });
    }

    try {
      const upd = await pool.query(
        `UPDATE frames
         SET prompt = $1, result = $2
         WHERE id = $3 AND project_id = $4
         RETURNING id, prompt, negative_prompt, result, meta, created_at`,
        [prompt, imageUrl, frameId, projectId],
      );
      if (upd.rows.length === 0) {
        await pool.query(
          `INSERT INTO transactions (user_id, delta, name, notes)
           VALUES ($1, $2, $3, $4)`,
          [
            req.user.id,
            IMAGE_GEN_TOKEN_COST,
            "Refund",
            "Frame row missing after generation",
          ],
        );
        return res.status(404).json({ error: "Frame not found" });
      }
      const tokRow = await pool.query(
        `SELECT tokens FROM users WHERE id = $1`,
        [req.user.id],
      );
      return res.json({
        frame: upd.rows[0],
        tokens: tokRow.rows[0]?.tokens ?? 0,
      });
    } catch (e) {
      console.error(e);
      try {
        await pool.query(
          `INSERT INTO transactions (user_id, delta, name, notes)
           VALUES ($1, $2, $3, $4)`,
          [
            req.user.id,
            IMAGE_GEN_TOKEN_COST,
            "Refund",
            String(e.message || "save failed").slice(0, 500),
          ],
        );
      } catch (refundErr) {
        console.error(refundErr);
      }
      return res.status(500).json({ error: "Could not save frame" });
    }
  });

  router.post("/:projectId/frames", async (req, res) => {
    const { projectId } = req.params;
    if (!isUuid(projectId)) {
      return res.status(400).json({ error: "Invalid project id" });
    }
    const proj = await getProjectIfAccessible(pool, projectId, req.user.id);
    if (!proj) {
      return res.status(404).json({ error: "Project not found" });
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const ins = await client.query(
        `INSERT INTO frames (project_id, prompt, result)
         VALUES ($1, '', NULL)
         RETURNING id`,
        [projectId],
      );
      const newId = ins.rows[0].id;
      await client.query(
        `UPDATE projects
         SET frame_ids = array_append(COALESCE(frame_ids, '{}'::uuid[]), $2::uuid)
         WHERE id = $1`,
        [projectId, newId],
      );
      await client.query("COMMIT");
      const full = await pool.query(
        `SELECT id, prompt, negative_prompt, result, meta, created_at
         FROM frames WHERE id = $1`,
        [newId],
      );
      return res.status(201).json({ frame: full.rows[0] });
    } catch (e) {
      await client.query("ROLLBACK");
      console.error(e);
      return res.status(500).json({ error: "Could not add frame" });
    } finally {
      client.release();
    }
  });

  router.delete("/:projectId/frames/:frameId", async (req, res) => {
    const { projectId, frameId } = req.params;
    if (!isUuid(projectId) || !isUuid(frameId)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const proj = await getProjectIfAccessible(pool, projectId, req.user.id);
    if (!proj) {
      return res.status(404).json({ error: "Project not found" });
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE projects SET frame_ids = array_remove(frame_ids, $2::uuid)
         WHERE id = $1`,
        [projectId, frameId],
      );
      const del = await client.query(
        `DELETE FROM frames WHERE id = $1 AND project_id = $2 RETURNING id`,
        [frameId, projectId],
      );
      await client.query("COMMIT");
      if (del.rows.length === 0) {
        return res.status(404).json({ error: "Frame not found" });
      }
      return res.status(204).end();
    } catch (e) {
      await client.query("ROLLBACK");
      console.error(e);
      return res.status(500).json({ error: "Could not delete frame" });
    } finally {
      client.release();
    }
  });

  router.get("/:id", async (req, res) => {
    const { id } = req.params;
    if (!isUuid(id)) {
      return res.status(400).json({ error: "Invalid project id" });
    }
    try {
      const proj = await getProjectIfAccessible(pool, id, req.user.id);
      if (!proj) {
        return res.status(404).json({ error: "Project not found" });
      }
      let framesRows;
      const frames = await pool.query(
        `SELECT id, prompt, negative_prompt, result, meta, created_at
         FROM frames
         WHERE project_id = $1
         ORDER BY COALESCE(array_position($2::uuid[], id), 2147483647), created_at`,
        [id, proj.frame_ids || []],
      );
      framesRows = frames.rows;

      /* Older API-created projects may have no frame rows yet; seed two for the editor. */
      if (framesRows.length === 0 && proj.owner_id === req.user.id) {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const f1 = await client.query(
            `INSERT INTO frames (project_id, prompt, result) VALUES ($1, '', NULL) RETURNING id`,
            [id],
          );
          const f2 = await client.query(
            `INSERT INTO frames (project_id, prompt, result) VALUES ($1, '', NULL) RETURNING id`,
            [id],
          );
          const seededIds = [f1.rows[0].id, f2.rows[0].id];
          await client.query(
            `UPDATE projects SET frame_ids = $2::uuid[] WHERE id = $1`,
            [id, seededIds],
          );
          await client.query("COMMIT");
          proj.frame_ids = seededIds;
          const again = await pool.query(
            `SELECT id, prompt, negative_prompt, result, meta, created_at
             FROM frames
             WHERE project_id = $1
             ORDER BY COALESCE(array_position($2::uuid[], id), 2147483647), created_at`,
            [id, seededIds],
          );
          framesRows = again.rows;
        } catch (be) {
          await client.query("ROLLBACK").catch(() => {});
          console.error(be);
        } finally {
          client.release();
        }
      }

      return res.json({ project: proj, frames: framesRows });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Could not load project" });
    }
  });

  return router;
};
