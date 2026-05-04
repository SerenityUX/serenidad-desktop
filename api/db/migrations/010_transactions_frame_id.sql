ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS frame_id UUID REFERENCES frames (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_frame_id ON transactions (frame_id);

COMMENT ON COLUMN transactions.frame_id IS 'Optional link to the frame whose generation this charge/refund corresponds to.';
