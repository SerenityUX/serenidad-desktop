const express = require("express");
const multer = require("multer");
const { fal } = require("@fal-ai/client");
const {
  transcribeAudio,
  generateVoiceUpdate,
  synthesizeSpeech,
  getFalCredentials,
} = require("../lib/voicePrompt");

const VOICE_TOKEN_COST = 1;
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

module.exports = function createVoiceRouter(pool, requireAuth) {
  const router = express.Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_AUDIO_BYTES },
  });

  router.post(
    "/prompt",
    requireAuth,
    (req, res, next) => {
      upload.single("audio")(req, res, (err) => {
        if (err) {
          return res.status(400).json({
            error: err.message || "Upload failed",
          });
        }
        next();
      });
    },
    async (req, res) => {
      if (!req.file?.buffer) {
        return res.status(400).json({ error: "Missing audio file" });
      }

      // Charge tokens BEFORE we open the SSE stream so we can return a clean 402.
      const debitClient = await pool.connect();
      try {
        await debitClient.query("BEGIN");
        const bal = await debitClient.query(
          `SELECT tokens FROM users WHERE id = $1 FOR UPDATE`,
          [req.user.id],
        );
        const current = bal.rows[0]?.tokens ?? 0;
        if (current < VOICE_TOKEN_COST) {
          await debitClient.query("ROLLBACK");
          debitClient.release();
          return res.status(402).json({
            error: "Insufficient tokens",
            tokens: current,
            required: VOICE_TOKEN_COST,
          });
        }
        await debitClient.query(
          `INSERT INTO transactions (user_id, delta, name, notes)
           VALUES ($1, $2, $3, $4)`,
          [req.user.id, -VOICE_TOKEN_COST, "Voice prompt", "voice → prompt"],
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
            [
              req.user.id,
              VOICE_TOKEN_COST,
              "Refund",
              `voice prompt: ${String(notes || "").slice(0, 480)}`,
            ],
          );
        } catch (e) {
          console.error(e);
        }
      };

      // SSE setup
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();

      let closed = false;
      req.on("close", () => {
        closed = true;
      });

      const send = (event, data) => {
        if (closed) return;
        try {
          res.write(`event: ${event}\n`);
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch {
          /* connection gone */
        }
      };

      const falKey = getFalCredentials();
      if (falKey) fal.config({ credentials: falKey });

      const currentPrompt = String(req.body?.current_prompt || "")
        .trim()
        .slice(0, 2000);
      const currentVoiceline = String(req.body?.current_voiceline || "")
        .trim()
        .slice(0, 1000);
      const context = String(req.body?.context || "").trim().slice(0, 8000);
      const modelId = String(req.body?.model_id || "").trim().slice(0, 200);
      let references = [];
      if (req.body?.references) {
        try {
          const parsed = JSON.parse(req.body.references);
          if (Array.isArray(parsed)) {
            references = parsed
              .filter((u) => typeof u === "string" && u.trim())
              .slice(0, 8);
          }
        } catch {
          /* ignore */
        }
      }

      let transcript;
      try {
        transcript = await transcribeAudio({
          buffer: req.file.buffer,
          contentType: req.file.mimetype,
        });
      } catch (e) {
        console.error("STT failed:", e);
        await refundTokens(e.message || "stt failed");
        send("error", { error: e.message || "Transcription failed" });
        return res.end();
      }
      send("transcript", { text: transcript });

      let update;
      try {
        update = await generateVoiceUpdate({
          transcript,
          currentPrompt,
          currentVoiceline,
          context,
          modelId,
          references,
        });
        send("voice_update", update);
      } catch (e) {
        console.error("voice update failed:", e.message);
        await refundTokens(e.message || "voice update failed");
        send("error", { error: `Voice update failed: ${e.message}` });
        return res.end();
      }

      if (falKey && update.editorResponse) {
        try {
          const audioUrl = await synthesizeSpeech(update.editorResponse);
          if (audioUrl) send("response_audio", { url: audioUrl });
        } catch (e) {
          console.warn("TTS failed:", e.message);
        }
      }

      const tokRow = await pool.query(
        `SELECT tokens FROM users WHERE id = $1`,
        [req.user.id],
      );
      send("done", {
        tokens: tokRow.rows[0]?.tokens ?? 0,
        token_cost: VOICE_TOKEN_COST,
      });
      res.end();
    },
  );

  return router;
};
