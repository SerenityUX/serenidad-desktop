-- Token balance on users is maintained only via transactions (trigger); do not update users.tokens manually.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tokens INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT transactions_delta_nonzero CHECK (delta <> 0)
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON transactions (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION apply_user_token_delta()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users SET tokens = tokens + NEW.delta WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_transactions_adjust_tokens ON transactions;
CREATE TRIGGER tr_transactions_adjust_tokens
  AFTER INSERT ON transactions
  FOR EACH ROW
  EXECUTE PROCEDURE apply_user_token_delta();

COMMENT ON COLUMN users.tokens IS 'Balance maintained by trigger from transactions.delta (credits positive, debits negative)';
COMMENT ON TABLE transactions IS 'Ledger: delta > 0 credit, delta < 0 debit';
