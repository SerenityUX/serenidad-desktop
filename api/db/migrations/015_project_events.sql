-- Realtime + undo history. Every mutation that should sync to peers writes
-- one row here, then pg_notify('cocreate_changes', ...) fans it out via the
-- single LISTEN connection in api/lib/realtime.js.
--
-- The row is also the audit/undo log: `inverse` (when set) describes the
-- operation that would undo this event, used by the client-side undo stack.
-- `actor_id` is the user who caused the change (the human who pressed the
-- button OR the human who told the agent to do it). Agent-driven actions
-- carry actor_id of the user that prompted the agent so undo lands on the
-- right person's stack.

CREATE TABLE IF NOT EXISTS project_events (
  id BIGSERIAL PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users (id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('user', 'agent', 'system')),
  kind TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  inverse JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_events_project_id_id
  ON project_events (project_id, id);

CREATE INDEX IF NOT EXISTS idx_project_events_created_at
  ON project_events (created_at);
