-- Stripe webhook idempotency. Stripe redelivers events on retries; we
-- record each processed event_id and reject duplicates so a re-delivered
-- `checkout.session.completed` doesn't double-credit tokens.

CREATE TABLE IF NOT EXISTS stripe_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
