-- Tracks any promo code attached at signup time so the welcome credit at
-- /verify-otp can vary (e.g., the /tenbuck landing page grants ✻1000).
-- Cleared after the credit is applied.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS signup_promo TEXT;
