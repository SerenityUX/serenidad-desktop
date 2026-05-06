const express = require("express");
const crypto = require("crypto");
const multer = require("multer");
const {
  generateOtpDigits,
  hashOtp,
  generateSessionToken,
  OTP_TTL_MS,
} = require("../lib/otp");
const { sendOtpEmail } = require("../lib/email");
const { putProfileImage } = require("../lib/s3Upload");
const { getPaymentLinkUrls } = require("../lib/stripeClient");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, WebP, or GIF images are allowed"));
    }
  },
});

module.exports = function createAuthRouter(pool, requireAuth) {
  const router = express.Router();

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  // Promo codes accepted at signup time. Each maps to a credit applied
  // on first /verify-otp. Keep this list short and explicit — anything
  // not in here is silently ignored.
  const PROMO_GRANTS = {
    tenbuck: 1000,
  };

  router.post("/signup", async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const name = String(req.body?.name || "").trim();
    const rawPromo = String(req.body?.promo || "").trim().toLowerCase();
    const promo = rawPromo && PROMO_GRANTS[rawPromo] ? rawPromo : null;
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
        `SELECT id, pending_signup FROM users WHERE email = $1`,
        [email],
      );

      let ins;
      let upgradedExisting = false;
      if (existing.rows.length > 0) {
        if (!existing.rows[0].pending_signup) {
          return res.status(409).json({ error: "Email already registered" });
        }
        ins = await pool.query(
          `UPDATE users
           SET name = $2, otp = $3, otp_expires_at = $4, signup_promo = $5
           WHERE id = $1
           RETURNING id`,
          [existing.rows[0].id, name, otpHash, expires, promo],
        );
        upgradedExisting = true;
      } else {
        try {
          ins = await pool.query(
            `INSERT INTO users (name, email, otp, otp_expires_at, signup_promo)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [name, email, otpHash, expires, promo],
          );
        } catch (insertErr) {
          if (insertErr.code === "23505") {
            return res.status(409).json({ error: "Email already registered" });
          }
          throw insertErr;
        }
      }

      try {
        await sendOtpEmail(email, otp);
      } catch (e) {
        if (!upgradedExisting) {
          await pool.query(`DELETE FROM users WHERE id = $1`, [
            ins.rows[0].id,
          ]);
        } else {
          await pool.query(
            `UPDATE users SET otp = NULL, otp_expires_at = NULL WHERE id = $1`,
            [ins.rows[0].id],
          );
        }
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
        `SELECT id FROM users WHERE email = $1 AND pending_signup = FALSE`,
        [email],
      );
      // Don't reveal whether the email exists — return ok either way and
      // only send a code if it does. Prevents account enumeration.
      if (found.rows.length === 0) {
        return res.json({ ok: true });
      }

      await pool.query(
        `UPDATE users
         SET otp = $2, otp_expires_at = $3, token = NULL,
             otp_attempts = 0, otp_locked_until = NULL
         WHERE id = $1`,
        [found.rows[0].id, otpHash, expires],
      );

      try {
        await sendOtpEmail(email, otp);
      } catch (e) {
        console.error("Resend:", e.message);
        // Still return ok so timing/error doesn't leak account existence.
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

    const MAX_OTP_ATTEMPTS = 5;
    const LOCKOUT_MS = 15 * 60 * 1000;

    try {
      const r = await pool.query(
        `SELECT id, name, email, profile_picture, otp, otp_expires_at, created_at, tokens, role,
                otp_attempts, otp_locked_until, pending_signup, signup_promo
         FROM users WHERE email = $1`,
        [email],
      );
      // Use a generic error so /verify-otp can't be used for account enumeration.
      const generic = () => res.status(401).json({ error: "Invalid code" });
      if (r.rows.length === 0) return generic();
      const row = r.rows[0];
      if (row.otp_locked_until && new Date(row.otp_locked_until) > new Date()) {
        return res
          .status(429)
          .json({ error: "Too many attempts — try again later" });
      }
      if (!row.otp || !row.otp_expires_at) return generic();
      if (new Date(row.otp_expires_at) < new Date()) return generic();

      const stored = Buffer.from(String(row.otp), "hex");
      const expected = Buffer.from(expectedHashHex, "hex");
      const ok =
        stored.length === expected.length &&
        crypto.timingSafeEqual(stored, expected);

      if (!ok) {
        const nextAttempts = (row.otp_attempts || 0) + 1;
        if (nextAttempts >= MAX_OTP_ATTEMPTS) {
          // Lock the account *and* invalidate the OTP so a fresh code is
          // required even after the lockout window.
          await pool.query(
            `UPDATE users
             SET otp = NULL, otp_expires_at = NULL,
                 otp_attempts = 0,
                 otp_locked_until = $2
             WHERE id = $1`,
            [row.id, new Date(Date.now() + LOCKOUT_MS)],
          );
          return res
            .status(429)
            .json({ error: "Too many attempts — try again later" });
        }
        await pool.query(
          `UPDATE users SET otp_attempts = $2 WHERE id = $1`,
          [row.id, nextAttempts],
        );
        return generic();
      }

      const token = generateSessionToken();
      await pool.query(
        `UPDATE users
         SET token = $2, otp = NULL, otp_expires_at = NULL,
             otp_attempts = 0, otp_locked_until = NULL,
             pending_signup = FALSE
         WHERE id = $1`,
        [row.id, token],
      );

      let tokensBalance = row.tokens ?? 0;
      // Welcome grant on first successful verify. /tenbuck signups get
      // ✻1000; everyone else gets the standard ✻100 ($1).
      if (row.pending_signup) {
        const promo = row.signup_promo || null;
        const grantAmount =
          promo && PROMO_GRANTS[promo] ? PROMO_GRANTS[promo] : 100;
        const grantLabel = promo === "tenbuck" ? "Welcome credit (Shiba Buck)" : "Welcome credit";
        const grantNote =
          promo === "tenbuck"
            ? "Free $10 from /tenbuck"
            : "Free $1 to get started";
        try {
          await pool.query(
            `INSERT INTO transactions (user_id, delta, name, notes)
             VALUES ($1, $2, $3, $4)`,
            [row.id, grantAmount, grantLabel, grantNote],
          );
          tokensBalance = (tokensBalance || 0) + grantAmount;
        } catch (grantErr) {
          console.error("welcome grant failed:", grantErr);
        }
        try {
          await pool.query(
            `UPDATE users SET signup_promo = NULL WHERE id = $1`,
            [row.id],
          );
        } catch (clearErr) {
          console.error("clearing signup_promo failed:", clearErr);
        }
      }

      return res.json({
        token,
        user: {
          id: row.id,
          name: row.name,
          email: row.email,
          profile_picture: row.profile_picture,
          created_at: row.created_at,
          tokens: tokensBalance,
          role: row.role || "user",
        },
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Verification failed" });
    }
  });

  router.get("/me", requireAuth, (req, res) => {
    res.json({ user: req.user });
  });

  router.get("/transactions", requireAuth, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT
           t.id, t.delta, t.name, t.notes, t.created_at, t.frame_id,
           f.prompt AS frame_prompt,
           f.result AS frame_result,
           f.model  AS frame_model,
           f.reference_urls AS frame_reference_urls
         FROM transactions t
         LEFT JOIN frames f ON f.id = t.frame_id
         WHERE t.user_id = $1
         ORDER BY t.created_at DESC
         LIMIT 200`,
        [req.user.id],
      );
      const balRow = await pool.query(
        `SELECT tokens FROM users WHERE id = $1`,
        [req.user.id],
      );
      const transactions = r.rows.map((row) => ({
        id: row.id,
        delta: row.delta,
        name: row.name,
        notes: row.notes,
        created_at: row.created_at,
        frame: row.frame_id
          ? {
              id: row.frame_id,
              prompt: row.frame_prompt || "",
              result: row.frame_result || null,
              model: row.frame_model || null,
              reference_urls: Array.isArray(row.frame_reference_urls)
                ? row.frame_reference_urls
                : [],
            }
          : null,
      }));
      res.json({
        tokens: balRow.rows[0]?.tokens ?? 0,
        transactions,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Could not load transactions" });
    }
  });

  // 1 token ≈ 1¢ of model spend.
  // Subscription = 20% margin → 80 tokens per $1.
  // One-time     = 30% margin → 70 tokens per $1, sold via a single Stripe
  //               payment link with adjustable quantity (1 unit = $1 = 70 tokens).
  router.get("/token-packages", requireAuth, async (req, res) => {
    // URLs come from Stripe at runtime (matched by kodan_id metadata that
    // scripts/setupStripe.js wrote). The operator no longer needs to paste
    // four STRIPE_PAYMENT_LINK_* env vars — only STRIPE_SECRET_KEY.
    const fallback = "https://stripe.com";
    let links = {};
    try {
      links = await getPaymentLinkUrls();
    } catch (e) {
      console.warn("[token-packages] payment-link lookup failed:", e.message);
    }
    const subscriptions = [
      {
        id: "sub_starter",
        label: "Starter",
        tokens: 800,
        priceLabel: "$10/mo",
        paymentLinkUrl: links.sub_starter || fallback,
      },
      {
        id: "sub_creator",
        label: "Creator",
        tokens: 2400,
        priceLabel: "$30/mo",
        paymentLinkUrl: links.sub_creator || fallback,
      },
      {
        id: "sub_studio",
        label: "Studio",
        tokens: 12000,
        priceLabel: "$150/mo",
        paymentLinkUrl: links.sub_studio || fallback,
      },
    ];
    const oneTime = {
      // Stripe payment link is configured with adjustable quantity,
      // unit = $1, sold as 70 tokens per unit.
      tokensPerUnit: 70,
      dollarsPerUnit: 1,
      minDollars: 5,
      maxDollars: 500,
      paymentLinkUrl: links.buy_tokens || fallback,
    };
    res.json({ subscriptions, oneTime });
  });

  router.post(
    "/profile-picture",
    requireAuth,
    (req, res, next) => {
      upload.single("file")(req, res, (err) => {
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
      if (!req.file?.buffer) {
        return res.status(400).json({ error: "Missing file" });
      }

      const extMap = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
      };
      const ext = extMap[req.file.mimetype.toLowerCase()];
      if (!ext) {
        return res.status(400).json({ error: "Unsupported image type" });
      }

      const userId = req.user.id;
      const key = `profiles/${userId}/${crypto.randomUUID()}${ext}`;

      try {
        const url = await putProfileImage({
          key,
          body: req.file.buffer,
          contentType: req.file.mimetype,
        });
        const upd = await pool.query(
          `UPDATE users SET profile_picture = $1 WHERE id = $2
           RETURNING id, name, email, profile_picture, created_at, tokens, role`,
          [url, userId],
        );
        const row = upd.rows[0];
        res.json({
          user: {
            id: row.id,
            name: row.name,
            email: row.email,
            profile_picture: row.profile_picture,
            created_at: row.created_at,
            tokens: row.tokens ?? 0,
            role: row.role || "user",
          },
        });
      } catch (e) {
        console.error(e);
        const msg =
          String(e.message || "").includes("S3_BUCKET") ||
          String(e.message || "").includes("Object storage")
            ? "File storage is not configured"
            : "Could not upload profile picture";
        res.status(503).json({ error: msg });
      }
    },
  );

  return router;
};
