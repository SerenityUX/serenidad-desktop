-- Pending agent runs. When the chat agent emits a generate_scene tool call,
-- the server stops the loop, persists the in-flight conversation here, and
-- waits for the user to approve or skip each proposed generation. Resuming
-- replays the saved state, runs the approved generations, and continues the
-- agent loop until either completion or another pause.

CREATE TABLE IF NOT EXISTS chat_pending_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats (id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_pending_runs_chat_id
  ON chat_pending_runs (chat_id);
