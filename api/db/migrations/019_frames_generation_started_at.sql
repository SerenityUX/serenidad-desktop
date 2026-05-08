-- Tracks when an image generation began for a frame. Set at the moment we
-- dispatch to the provider and cleared when the frame is
-- saved (success or failure). The client uses this + the model's
-- estimatedDurationSec to render a realistic progress bar that survives
-- refresh and follows along on other devices via realtime.

ALTER TABLE frames
  ADD COLUMN IF NOT EXISTS generation_started_at TIMESTAMPTZ;
