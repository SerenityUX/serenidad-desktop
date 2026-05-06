-- Tighten data-integrity invariants that the application code has been
-- assuming but not enforcing. Each constraint here corresponds to a class of
-- bug we've actually hit (or could trivially hit) at the application layer.
--
-- Bug class → constraint:
--   "Duplicate Hiroshi"           → UNIQUE (project_id, lower(name)) on characters
--   "Blank-name character"        → CHECK characters.name is non-empty after trim
--   "Project with width=undefined → CHECK projects.width / height positive
--   "Privileged role typo"        → CHECK users.role IN ('user','admin')
--   "Empty project name"          → CHECK projects.name non-empty after trim

BEGIN;

-- 1) Dedupe existing duplicate characters before adding the unique index.
--    Same project + case-insensitive same name = duplicate. Keep the one
--    with a portrait if any (image_url IS NOT NULL wins), otherwise the
--    most recently created. NULL portraits lose ties.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY project_id, lower(name)
           ORDER BY (image_url IS NOT NULL) DESC, created_at DESC
         ) AS rn
  FROM characters
)
DELETE FROM characters
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2) characters: case-insensitive unique name within a project. This is the
--    real fix for the "create_character was supposed to be idempotent but a
--    race condition let two through" failure mode — the application layer
--    can no longer be the only line of defense.
CREATE UNIQUE INDEX IF NOT EXISTS characters_project_lower_name_uniq
  ON characters (project_id, lower(name));

-- 3) characters: name must be non-blank after trim. NOT VALID grandfathers
--    any pre-existing rows that violate the constraint — only future writes
--    are checked. Avoids the failure mode where a single bad row in
--    production blocks the entire migration from applying and prevents the
--    server from booting via `start:deploy`.
ALTER TABLE characters
  DROP CONSTRAINT IF EXISTS characters_name_not_blank;
ALTER TABLE characters
  ADD CONSTRAINT characters_name_not_blank
  CHECK (char_length(btrim(name)) > 0)
  NOT VALID;

-- 4) projects: dimensions must be positive. NOT VALID for the same reason
--    as above.
ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_dimensions_positive;
ALTER TABLE projects
  ADD CONSTRAINT projects_dimensions_positive
  CHECK (width > 0 AND height > 0)
  NOT VALID;

-- 5) projects: name must be non-blank.
ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_name_not_blank;
ALTER TABLE projects
  ADD CONSTRAINT projects_name_not_blank
  CHECK (char_length(btrim(name)) > 0)
  NOT VALID;

-- 6) users.role: closed enum. The route code does `role === 'admin'` and
--    anything else falls into the user bucket — fine — but we want any
--    write that tries to set "moderator" or a typo to fail loudly.
--    NOT VALID so an in-flight value we don't know about doesn't break
--    deploy.
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_role_enum;
ALTER TABLE users
  ADD CONSTRAINT users_role_enum
  CHECK (role IN ('user', 'admin'))
  NOT VALID;

-- 7) chat_pending_runs.state must always be a JSON object (not null/array).
--    Resolve loops assume state.messages / state.toolLog / state.pending
--    are accessible — a bare null would crash the agent.
ALTER TABLE chat_pending_runs
  DROP CONSTRAINT IF EXISTS chat_pending_runs_state_object;
ALTER TABLE chat_pending_runs
  ADD CONSTRAINT chat_pending_runs_state_object
  CHECK (jsonb_typeof(state) = 'object')
  NOT VALID;

COMMIT;
