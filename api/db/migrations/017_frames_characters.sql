-- Per-frame ordered list of bound characters. Order matters: index 0 maps to
-- Character1 in the rewritten prompt, index 1 to Character2, etc. Bound
-- characters' portraits are prepended to the frame's reference image set in
-- the same order at generation time.
ALTER TABLE frames
  ADD COLUMN IF NOT EXISTS character_ids UUID[] NOT NULL DEFAULT '{}'::uuid[];

COMMENT ON COLUMN frames.character_ids IS
  'Characters bound to this frame, in slot order (Character1, Character2, ...). Their portraits are prepended to reference_urls at generation.';
