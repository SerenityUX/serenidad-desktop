const crypto = require("crypto");

const OTP_LENGTH = 6;
const OTP_TTL_MS = 10 * 60 * 1000;

function generateOtpDigits() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(OTP_LENGTH, "0");
}

function hashOtp(code) {
  const secret = process.env.OTP_SECRET;
  if (!secret) {
    throw new Error("OTP_SECRET is not set");
  }
  return crypto.createHmac("sha256", secret).update(code).digest("hex");
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

module.exports = {
  generateOtpDigits,
  hashOtp,
  generateSessionToken,
  OTP_TTL_MS,
  OTP_LENGTH,
};
