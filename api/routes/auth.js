const express = require("express");
const crypto = require("crypto");
const {
  generateOtpDigits,
  hashOtp,
  generateSessionToken,
  OTP_TTL_MS,
} = require("../lib/otp");
const { sendOtpEmail } = require("../lib/email");

module.exports = function createAuthRouter(pool) {
  const router = express.Router();

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  router.post("/signup", async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const name = String(req.body?.name || "").trim();
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Invalid email" });
    }
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    let otp;
    let otpHash;
    try {
      otp = generateOtpDigits();
      otpHash = hashOtp(otp);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Server misconfigured" });
    }

    const expires = new Date(Date.now() + OTP_TTL_MS);

    try {
      const existing = await pool.query(
        `SELECT id FROM users WHERE email = $1`,
        [email],
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: "Email already registered" });
      }

      let ins;
      try {
        ins = await pool.query(
          `INSERT INTO users (name, email, otp, otp_expires_at)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [name, email, otpHash, expires],
        );
      } catch (insertErr) {
        if (insertErr.code === "23505") {
          return res.status(409).json({ error: "Email already registered" });
        }
        throw insertErr;
      }

      try {
        await sendOtpEmail(email, otp);
      } catch (e) {
        await pool.query(`DELETE FROM users WHERE id = $1`, [
          ins.rows[0].id,
        ]);
        console.error("Resend:", e.message);
        return res.status(502).json({ error: "Could not send email" });
      }

      return res.json({ ok: true });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Signup failed" });
    }
  });

  router.post("/login", async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Invalid email" });
    }

    let otp;
    let otpHash;
    try {
      otp = generateOtpDigits();
      otpHash = hashOtp(otp);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Server misconfigured" });
    }

    const expires = new Date(Date.now() + OTP_TTL_MS);

    try {
      const found = await pool.query(
        `SELECT id FROM users WHERE email = $1`,
        [email],
      );
      if (found.rows.length === 0) {
        return res.status(404).json({ error: "No account for this email" });
      }

      await pool.query(
        `UPDATE users SET otp = $2, otp_expires_at = $3, token = NULL WHERE id = $1`,
        [found.rows[0].id, otpHash, expires],
      );

      try {
        await sendOtpEmail(email, otp);
      } catch (e) {
        console.error("Resend:", e.message);
        return res.status(502).json({ error: "Could not send email" });
      }

      return res.json({ ok: true });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Login failed" });
    }
  });

  router.post("/verify-otp", async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const otpRaw = String(req.body?.otp || "").trim().replace(/\s/g, "");
    if (!email || !otpRaw) {
      return res.status(400).json({ error: "Email and otp required" });
    }

    let expectedHashHex;
    try {
      expectedHashHex = hashOtp(otpRaw);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Server misconfigured" });
    }

    try {
      const r = await pool.query(
        `SELECT id, name, email, profile_picture, otp, otp_expires_at, created_at
         FROM users WHERE email = $1`,
        [email],
      );
      if (r.rows.length === 0) {
        return res.status(404).json({ error: "Not found" });
      }
      const row = r.rows[0];
      if (!row.otp || !row.otp_expires_at) {
        return res.status(400).json({ error: "No pending code" });
      }
      if (new Date(row.otp_expires_at) < new Date()) {
        return res.status(400).json({ error: "Code expired" });
      }

      const stored = Buffer.from(String(row.otp), "hex");
      const expected = Buffer.from(expectedHashHex, "hex");
      if (
        stored.length !== expected.length ||
        !crypto.timingSafeEqual(stored, expected)
      ) {
        return res.status(401).json({ error: "Invalid code" });
      }

      const token = generateSessionToken();
      await pool.query(
        `UPDATE users SET token = $2, otp = NULL, otp_expires_at = NULL WHERE id = $1`,
        [row.id, token],
      );

      return res.json({
        token,
        user: {
          id: row.id,
          name: row.name,
          email: row.email,
          profile_picture: row.profile_picture,
          created_at: row.created_at,
        },
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Verification failed" });
    }
  });

  return router;
};
