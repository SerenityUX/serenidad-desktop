-- Replace negative_prompt with reference image URLs and a per-frame model id
ALTER TABLE frames
  ADD COLUMN IF NOT EXISTS reference_urls TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS model TEXT;

ALTER TABLE frames DROP COLUMN IF EXISTS negative_prompt;

COMMENT ON COLUMN frames.reference_urls IS 'HTTPS URLs of reference images sent to the image model';
COMMENT ON COLUMN frames.model IS 'fal.ai model id used (or to be used) to generate this frame';
