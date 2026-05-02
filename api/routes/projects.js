const express = require("express");
const crypto = require("crypto");
const multer = require("multer");
const { isProbablyAssetUrl } = require("../lib/assetUrl");
const { generateFalImage } = require("../lib/falImage");
const { generateFalVideo } = require("../lib/falVideo");
const {
  FAL_IMAGE_MODELS,
  FAL_VIDEO_MODELS,
  DEFAULT_MODEL_ID,
  DEFAULT_VIDEO_MODEL_ID,
  resolveModelOrDefault,
  resolveVideoModelOrDefault,
} = require("../lib/falModels");
const { putProfileImage } = require("../lib/s3Upload");
const {
  sendProjectShareEmail,
  sendProjectInviteSignupEmail,
} = require("../lib/email");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(s) {
  return typeof s === "string" && UUID_RE.test(s);
}

const FRAME_COLUMNS = `id, prompt, result, reference_urls, model, meta, created_at`;

const REFERENCE_MIME_EXT = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const referenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (REFERENCE_MIME_EXT[String(file.mimetype || "").toLowerCase()]) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, WebP, or GIF images are allowed"));
    }
  },
});

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

  router.get("/models", (_req, res) => {
    res.json({
      models: FAL_IMAGE_MODELS.map((m) => ({
        id: m.id,
        label: m.label,
        costCents: m.costCents,
        supportsReferences: m.supportsReferences,
      })),
      defaultId: DEFAULT_MODEL_ID,
      videoModels: FAL_VIDEO_MODELS.map((m) => ({
        id: m.id,
        label: m.label,
        costCents: m.costCents,
        defaultDuration: m.defaultDuration,
        supportsReferences: m.supportsReferences !== false,
      })),
      defaultVideoId: DEFAULT_VIDEO_MODEL_ID,
    });
  });

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
        `INSERT INTO frames (project_id, prompt, result, model)
         VALUES ($1, '', NULL, $2)
         RETURNING id`,
        [row.id, DEFAULT_MODEL_ID],
      );
      const f2 = await client.query(
        `INSERT INTO frames (project_id, prompt, result, model)
         VALUES ($1, '', NULL, $2)
         RETURNING id`,
        [row.id, DEFAULT_MODEL_ID],
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

  router.patch("/:projectId/frame-order", async (req, res) => {
    const { projectId } = req.params;
    if (!isUuid(projectId)) {
      return res.status(400).json({ error: "Invalid project id" });
    }
    const proj = await getProjectIfAccessible(pool, projectId, req.user.id);
    if (!proj) {
      return res.status(404).json({ error: "Project not found" });
    }
    const incoming = Array.isArray(req.body?.frame_ids) ? req.body.frame_ids : null;
    if (!incoming || !incoming.every(isUuid)) {
      return res
        .status(400)
        .json({ error: "frame_ids must be an array of frame uuids" });
    }
    if (new Set(incoming).size !== incoming.length) {
      return res.status(400).json({ error: "frame_ids contains duplicates" });
    }
    try {
      const cur = await pool.query(
        `SELECT id FROM frames WHERE project_id = $1`,
        [projectId],
      );
      const have = new Set(cur.rows.map((r) => r.id));
      if (
        incoming.length !== have.size ||
        !incoming.every((id) => have.has(id))
      ) {
        return res
          .status(400)
          .json({ error: "frame_ids must match the project's frames exactly" });
      }
      await pool.query(
        `UPDATE projects SET frame_ids = $1::uuid[] WHERE id = $2`,
        [incoming, projectId],
      );
      return res.json({ frame_ids: incoming });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Could not reorder frames" });
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
    if (Object.prototype.hasOwnProperty.call(patch, "model")) {
      const m = patch.model == null ? null : String(patch.model);
      if (m && !resolveModelOrDefault(m)) {
        return res.status(400).json({ error: "Unknown model id" });
      }
      sets.push(`model = $${pi++}`);
      vals.push(m);
    }
    if (Object.prototype.hasOwnProperty.call(patch, "reference_urls")) {
      const arr = Array.isArray(patch.reference_urls) ? patch.reference_urls : [];
      const cleaned = arr
        .map((u) => String(u || "").trim())
        .filter((u) => u && isProbablyAssetUrl(u));
      sets.push(`reference_urls = $${pi++}::text[]`);
      vals.push(cleaned);
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
         RETURNING ${FRAME_COLUMNS}`,
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

  router.post(
    "/:projectId/frames/:frameId/references",
    (req, res, next) => {
      referenceUpload.single("file")(req, res, (err) => {
        if (err) {
          return res.status(400).json({
            error:
              err.message ||
              (typeof err === "string" ? err : "Upload failed"),
          });
        }
        next();
      });
    },
    async (req, res) => {
      const { projectId, frameId } = req.params;
      if (!isUuid(projectId) || !isUuid(frameId)) {
        return res.status(400).json({ error: "Invalid id" });
      }
      const proj = await getProjectIfAccessible(pool, projectId, req.user.id);
      if (!proj) {
        return res.status(404).json({ error: "Project not found" });
      }

      const frameCheck = await pool.query(
        `SELECT id FROM frames WHERE id = $1 AND project_id = $2`,
        [frameId, projectId],
      );
      if (frameCheck.rows.length === 0) {
        return res.status(404).json({ error: "Frame not found" });
      }

      let storedUrl;
      const bodyUrl =
        typeof req.body?.url === "string" ? req.body.url.trim() : "";

      if (req.file?.buffer) {
        const ext =
          REFERENCE_MIME_EXT[String(req.file.mimetype).toLowerCase()];
        if (!ext) {
          return res.status(400).json({ error: "Unsupported image type" });
        }
        const key = `references/${req.user.id}/${frameId}/${crypto.randomUUID()}${ext}`;
        try {
          storedUrl = await putProfileImage({
            key,
            body: req.file.buffer,
            contentType: req.file.mimetype,
          });
        } catch (e) {
          console.error(e);
          return res.status(503).json({ error: "Could not upload reference" });
        }
      } else if (bodyUrl && isProbablyAssetUrl(bodyUrl)) {
        storedUrl = bodyUrl;
      } else {
        return res
          .status(400)
          .json({ error: "Provide a file or an HTTPS url" });
      }

      try {
        const u = await pool.query(
          `UPDATE frames
           SET reference_urls = COALESCE(reference_urls, '{}'::text[]) || ARRAY[$1::text]
           WHERE id = $2 AND project_id = $3
           RETURNING ${FRAME_COLUMNS}`,
          [storedUrl, frameId, projectId],
        );
        return res.json({ frame: u.rows[0], url: storedUrl });
      } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Could not save reference" });
      }
    },
  );

  router.delete("/:projectId/frames/:frameId/references", async (req, res) => {
    const { projectId, frameId } = req.params;
    if (!isUuid(projectId) || !isUuid(frameId)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const proj = await getProjectIfAccessible(pool, projectId, req.user.id);
    if (!proj) {
      return res.status(404).json({ error: "Project not found" });
    }
    const url =
      typeof req.body?.url === "string" ? req.body.url.trim() : "";
    if (!url) {
      return res.status(400).json({ error: "url is required" });
    }
    try {
      const u = await pool.query(
        `UPDATE frames
         SET reference_urls = array_remove(COALESCE(reference_urls, '{}'::text[]), $1::text)
         WHERE id = $2 AND project_id = $3
         RETURNING ${FRAME_COLUMNS}`,
        [url, frameId, projectId],
      );
      if (u.rows.length === 0) {
        return res.status(404).json({ error: "Frame not found" });
      }
      return res.json({ frame: u.rows[0] });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Could not remove reference" });
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
      `SELECT id, model, reference_urls FROM frames WHERE id = $1 AND project_id = $2`,
      [frameId, projectId],
    );
    if (frameCheck.rows.length === 0) {
      return res.status(404).json({ error: "Frame not found" });
    }
    const frameRow = frameCheck.rows[0];

    const requestedModelId =
      String(req.body?.model || "").trim() ||
      frameRow.model ||
      DEFAULT_MODEL_ID;
    const model = resolveModelOrDefault(requestedModelId);
    if (!model) {
      return res.status(400).json({ error: "Unknown model id" });
    }

    const tokenCost = Math.max(1, Math.ceil(model.costCents));
    const referenceUrls = Array.isArray(frameRow.reference_urls)
      ? frameRow.reference_urls
      : [];

    const debitClient = await pool.connect();
    try {
      await debitClient.query("BEGIN");
      const bal = await debitClient.query(
        `SELECT tokens FROM users WHERE id = $1 FOR UPDATE`,
        [req.user.id],
      );
      const current = bal.rows[0]?.tokens ?? 0;
      if (current < tokenCost) {
        await debitClient.query("ROLLBACK");
        return res.status(402).json({
          error: "Insufficient tokens",
          tokens: current,
          required: tokenCost,
        });
      }
      await debitClient.query(
        `INSERT INTO transactions (user_id, delta, name, notes)
         VALUES ($1, $2, $3, $4)`,
        [
          req.user.id,
          -tokenCost,
          "Image generation",
          `${model.id} frame ${frameId}`,
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

    const refundTokens = async (notes) => {
      try {
        await pool.query(
          `INSERT INTO transactions (user_id, delta, name, notes)
           VALUES ($1, $2, $3, $4)`,
          [req.user.id, tokenCost, "Refund", String(notes || "").slice(0, 500)],
        );
      } catch (refundErr) {
        console.error(refundErr);
      }
    };

    let imageUrl;
    try {
      const out = await generateFalImage({
        modelId: model.id,
        prompt,
        width: proj.width,
        height: proj.height,
        referenceUrls,
      });
      imageUrl = out.url;
    } catch (falErr) {
      console.error(falErr);
      await refundTokens(falErr.message || "fal generation failed");
      return res.status(502).json({
        error: String(falErr.message || "Image generation failed"),
      });
    }

    if (!isProbablyAssetUrl(imageUrl)) {
      await refundTokens("Invalid image URL from provider");
      return res.status(502).json({ error: "Invalid image URL from provider" });
    }

    const saveClient = await pool.connect();
    let savedFrameRow = null;
    try {
      await saveClient.query("BEGIN");
      const upd = await saveClient.query(
        `UPDATE frames
         SET prompt = $1, result = $2, model = $3
         WHERE id = $4 AND project_id = $5
         RETURNING ${FRAME_COLUMNS}`,
        [prompt, imageUrl, model.id, frameId, projectId],
      );
      if (upd.rows.length === 0) {
        await saveClient.query("ROLLBACK");
        await refundTokens("Frame row missing after generation");
        return res.status(404).json({ error: "Frame not found" });
      }
      await saveClient.query(
        `UPDATE projects SET thumbnail = $1 WHERE id = $2`,
        [imageUrl, projectId],
      );
      await saveClient.query("COMMIT");
      savedFrameRow = upd.rows[0];
    } catch (e) {
      console.error(e);
      await saveClient.query("ROLLBACK").catch(() => {});
      await refundTokens(e.message || "save failed");
      return res.status(500).json({ error: "Could not save frame" });
    } finally {
      saveClient.release();
    }

    const tokRow = await pool.query(`SELECT tokens FROM users WHERE id = $1`, [
      req.user.id,
    ]);
    return res.json({
      frame: savedFrameRow,
      tokens: tokRow.rows[0]?.tokens ?? 0,
      projectThumbnail: imageUrl,
      tokenCost,
      model: { id: model.id, label: model.label, costCents: model.costCents },
    });
  });

  router.post("/:projectId/frames/:frameId/generate-video", async (req, res) => {
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
    const durationSeconds = Math.max(
      1,
      Math.min(30, Number(req.body?.durationSeconds) || 4),
    );

    const frameCheck = await pool.query(
      `SELECT id, model, reference_urls, meta FROM frames WHERE id = $1 AND project_id = $2`,
      [frameId, projectId],
    );
    if (frameCheck.rows.length === 0) {
      return res.status(404).json({ error: "Frame not found" });
    }
    const frameRow = frameCheck.rows[0];

    const requestedModelId =
      String(req.body?.model || "").trim() ||
      frameRow.model ||
      DEFAULT_VIDEO_MODEL_ID;
    const model = resolveVideoModelOrDefault(requestedModelId);
    if (!model) {
      return res.status(400).json({ error: "Unknown video model id" });
    }

    const referenceUrls = Array.isArray(frameRow.reference_urls)
      ? frameRow.reference_urls
      : [];
    if (referenceUrls.length < 1) {
      return res
        .status(400)
        .json({ error: "Video frames need at least one reference image" });
    }

    const tokenCost = Math.max(1, Math.ceil(model.costCents));
    const debitClient = await pool.connect();
    try {
      await debitClient.query("BEGIN");
      const bal = await debitClient.query(
        `SELECT tokens FROM users WHERE id = $1 FOR UPDATE`,
        [req.user.id],
      );
      const current = bal.rows[0]?.tokens ?? 0;
      if (current < tokenCost) {
        await debitClient.query("ROLLBACK");
        return res
          .status(402)
          .json({ error: "Insufficient tokens", tokens: current, required: tokenCost });
      }
      await debitClient.query(
        `INSERT INTO transactions (user_id, delta, name, notes)
         VALUES ($1, $2, $3, $4)`,
        [req.user.id, -tokenCost, "Video generation", `${model.id} frame ${frameId}`],
      );
      await debitClient.query("COMMIT");
    } catch (e) {
      await debitClient.query("ROLLBACK").catch(() => {});
      debitClient.release();
      console.error(e);
      return res.status(500).json({ error: "Could not debit tokens" });
    }
    debitClient.release();

    const refundTokens = async (notes) => {
      try {
        await pool.query(
          `INSERT INTO transactions (user_id, delta, name, notes)
           VALUES ($1, $2, $3, $4)`,
          [req.user.id, tokenCost, "Refund", String(notes || "").slice(0, 500)],
        );
      } catch (refundErr) {
        console.error(refundErr);
      }
    };

    let videoUrl;
    try {
      const out = await generateFalVideo({
        modelId: model.id,
        prompt,
        durationSeconds,
        referenceUrls,
        width: proj.width,
        height: proj.height,
      });
      videoUrl = out.url;
    } catch (falErr) {
      console.error(falErr);
      await refundTokens(falErr.message || "fal video generation failed");
      return res
        .status(502)
        .json({ error: String(falErr.message || "Video generation failed") });
    }

    if (!isProbablyAssetUrl(videoUrl)) {
      await refundTokens("Invalid video URL from provider");
      return res.status(502).json({ error: "Invalid video URL from provider" });
    }

    const saveClient = await pool.connect();
    let savedFrameRow = null;
    try {
      await saveClient.query("BEGIN");
      const upd = await saveClient.query(
        `UPDATE frames
         SET prompt = $1,
             result = $2,
             model = $3,
             meta = COALESCE(meta, '{}'::jsonb) || $4::jsonb
         WHERE id = $5 AND project_id = $6
         RETURNING ${FRAME_COLUMNS}`,
        [
          prompt,
          videoUrl,
          model.id,
          JSON.stringify({ kind: "video", durationSeconds }),
          frameId,
          projectId,
        ],
      );
      if (upd.rows.length === 0) {
        await saveClient.query("ROLLBACK");
        await refundTokens("Frame row missing after generation");
        return res.status(404).json({ error: "Frame not found" });
      }
      await saveClient.query("COMMIT");
      savedFrameRow = upd.rows[0];
    } catch (e) {
      console.error(e);
      await saveClient.query("ROLLBACK").catch(() => {});
      await refundTokens(e.message || "save failed");
      return res.status(500).json({ error: "Could not save frame" });
    } finally {
      saveClient.release();
    }

    const tokRow = await pool.query(`SELECT tokens FROM users WHERE id = $1`, [
      req.user.id,
    ]);
    return res.json({
      frame: savedFrameRow,
      tokens: tokRow.rows[0]?.tokens ?? 0,
      tokenCost,
      model: { id: model.id, label: model.label, costCents: model.costCents },
    });
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
        `INSERT INTO frames (project_id, prompt, result, model)
         VALUES ($1, '', NULL, $2)
         RETURNING id`,
        [projectId, DEFAULT_MODEL_ID],
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
        `SELECT ${FRAME_COLUMNS}
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
        `SELECT ${FRAME_COLUMNS}
         FROM frames
         WHERE project_id = $1
         ORDER BY COALESCE(array_position($2::uuid[], id), 2147483647), created_at`,
        [id, proj.frame_ids || []],
      );
      framesRows = frames.rows;

      if (framesRows.length === 0 && proj.owner_id === req.user.id) {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const f1 = await client.query(
            `INSERT INTO frames (project_id, prompt, result, model) VALUES ($1, '', NULL, $2) RETURNING id`,
            [id, DEFAULT_MODEL_ID],
          );
          const f2 = await client.query(
            `INSERT INTO frames (project_id, prompt, result, model) VALUES ($1, '', NULL, $2) RETURNING id`,
            [id, DEFAULT_MODEL_ID],
          );
          const seededIds = [f1.rows[0].id, f2.rows[0].id];
          await client.query(
            `UPDATE projects SET frame_ids = $2::uuid[] WHERE id = $1`,
            [id, seededIds],
          );
          await client.query("COMMIT");
          proj.frame_ids = seededIds;
          const again = await pool.query(
            `SELECT ${FRAME_COLUMNS}
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

  router.get("/:projectId/shares", async (req, res) => {
    const { projectId } = req.params;
    if (!isUuid(projectId)) {
      return res.status(400).json({ error: "Invalid project id" });
    }
    const proj = await getProjectIfAccessible(pool, projectId, req.user.id);
    if (!proj) {
      return res.status(404).json({ error: "Project not found" });
    }
    try {
      const r = await pool.query(
        `SELECT u.id, u.name, u.email, u.profile_picture, u.pending_signup
         FROM invites i
         JOIN users u ON u.id = i.sent_to
         WHERE i.project_id = $1
         ORDER BY u.email`,
        [projectId],
      );
      return res.json({
        shares: r.rows,
        membership: proj.membership,
        ownerId: proj.owner_id,
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Could not load shares" });
    }
  });

  router.delete("/:projectId/shares/:userId", async (req, res) => {
    const { projectId, userId } = req.params;
    if (!isUuid(projectId) || !isUuid(userId)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const proj = await getProjectIfAccessible(pool, projectId, req.user.id);
    if (!proj) {
      return res.status(404).json({ error: "Project not found" });
    }
    if (proj.owner_id !== req.user.id) {
      return res
        .status(403)
        .json({ error: "Only the owner can remove collaborators" });
    }
    try {
      const del = await pool.query(
        `DELETE FROM invites WHERE project_id = $1 AND sent_to = $2 RETURNING id`,
        [projectId, userId],
      );
      if (del.rows.length === 0) {
        return res.status(404).json({ error: "Collaborator not found" });
      }
      return res.json({ ok: true });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Could not remove collaborator" });
    }
  });

  router.post("/:projectId/share", async (req, res) => {
    const { projectId } = req.params;
    if (!isUuid(projectId)) {
      return res.status(400).json({ error: "Invalid project id" });
    }
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Invalid email" });
    }

    const proj = await getProjectIfAccessible(pool, projectId, req.user.id);
    if (!proj) {
      return res.status(404).json({ error: "Project not found" });
    }

    try {
      let recipientRow;
      let isNewSignup = false;
      const found = await pool.query(
        `SELECT id, name, email, pending_signup FROM users WHERE email = $1`,
        [email],
      );
      if (found.rows.length > 0) {
        recipientRow = found.rows[0];
      } else {
        const placeholderName = email.split("@")[0] || email;
        const ins = await pool.query(
          `INSERT INTO users (name, email, pending_signup)
           VALUES ($1, $2, TRUE)
           RETURNING id, name, email, pending_signup`,
          [placeholderName, email],
        );
        recipientRow = ins.rows[0];
        isNewSignup = true;
      }

      if (recipientRow.id === proj.owner_id) {
        return res
          .status(400)
          .json({ error: "Owner already has access to this project" });
      }
      if (recipientRow.id === req.user.id) {
        return res
          .status(400)
          .json({ error: "You cannot share a project with yourself" });
      }

      const existing = await pool.query(
        `SELECT id FROM invites WHERE project_id = $1 AND sent_to = $2`,
        [projectId, recipientRow.id],
      );
      const alreadyShared = existing.rows.length > 0;

      if (!alreadyShared) {
        await pool.query(
          `INSERT INTO invites (sent_from, sent_to, project_id)
           VALUES ($1, $2, $3)`,
          [req.user.id, recipientRow.id, projectId],
        );
      }

      const isPending = isNewSignup || recipientRow.pending_signup === true;

      try {
        if (isPending) {
          await sendProjectInviteSignupEmail({
            to: recipientRow.email,
            sharerName: req.user.name,
            sharerEmail: req.user.email,
          });
        } else {
          await sendProjectShareEmail({
            to: recipientRow.email,
            projectName: proj.name,
            sharerName: req.user.name,
            sharerEmail: req.user.email,
          });
        }
      } catch (mailErr) {
        console.error("Resend:", mailErr.message);
        return res.status(200).json({
          ok: true,
          alreadyShared,
          pending: isPending,
          emailed: false,
          warning: "Shared, but notification email could not be sent",
        });
      }

      return res.json({
        ok: true,
        alreadyShared,
        pending: isPending,
        emailed: true,
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Could not share project" });
    }
  });

  return router;
};
