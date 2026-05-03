const express = require("express");
const multer = require("multer");
const { processVoicePrompt } = require("../lib/voicePrompt");

const VOICE_TOKEN_COST = 1;
const MAX_AUDIO_BYTES = 8 * 1024 * 1024; // 8 MB cap; voice clips are short.

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
        } catch (refundErr) {
          console.error(refundErr);
        }
      };

      let result;
      try {
        result = await processVoicePrompt({
          buffer: req.file.buffer,
          contentType: req.file.mimetype,
          currentPrompt: req.body?.current_prompt,
        });
      } catch (e) {
        console.error(e);
        await refundTokens(e.message || "voice pipeline failed");
        return res
          .status(502)
          .json({ error: String(e.message || "Voice processing failed") });
      }

      const tokRow = await pool.query(
        `SELECT tokens FROM users WHERE id = $1`,
        [req.user.id],
      );
      return res.json({
        prompt: result.prompt,
        response: result.response,
        transcript: result.transcript,
        audio_url: result.audioUrl,
        tokens: tokRow.rows[0]?.tokens ?? 0,
        token_cost: VOICE_TOKEN_COST,
      });
    },
  );

  return router;
};
