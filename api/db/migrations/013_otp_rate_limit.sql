-- Per-user OTP attempt counter + lockout window. Used by /auth/verify-otp
-- to throttle brute force against the 6-digit code.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS otp_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS otp_locked_until TIMESTAMPTZ;
