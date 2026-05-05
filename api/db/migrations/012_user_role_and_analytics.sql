-- User role + analytics support.
--
-- `role` doubles as the subscription tier:
--   'user'    — free / no active subscription
--   'starter' | 'creator' | 'studio' — Stripe subscription tier (set by webhook)
--   'admin'   — unlimited tokens + access to /analytics
--
-- Webhook handlers in routes/billing.js update role on subscription start/cancel.
-- requireAuth treats role='admin' as unlimited (token debits are skipped).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

-- Per-request log; analytics rolls these up into DAU and a hits feed.
-- We log only authenticated requests (user_id NOT NULL) so DAU is accurate.
CREATE TABLE IF NOT EXISTS api_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  status INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_logs_created_at ON api_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_user_created ON api_logs (user_id, created_at DESC);
