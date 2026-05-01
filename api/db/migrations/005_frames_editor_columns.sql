-- Editor fields for frames (maps to scene rows in the desktop UI)
ALTER TABLE frames
  ADD COLUMN IF NOT EXISTS negative_prompt TEXT,
  ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN frames.meta IS 'JSON: captionSettings, voiceline, speaker, baseModel, selectedLora, etc.';
