-- Serenidad schema: Users, Projects, Frames, Invites
-- IDs: UUID (PostgreSQL 13+ gen_random_uuid)

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  profile_picture TEXT,
  otp TEXT
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  thumbnail TEXT,
  owner_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  frame_ids UUID[] NOT NULL DEFAULT '{}'::uuid[]
);

CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects (owner_id);

CREATE TABLE IF NOT EXISTS frames (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt TEXT,
  result TEXT,
  project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_frames_project_id ON frames (project_id);

CREATE TABLE IF NOT EXISTS invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_from UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  sent_to UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  CONSTRAINT invites_sender_not_recipient CHECK (sent_from IS DISTINCT FROM sent_to)
);

CREATE INDEX IF NOT EXISTS idx_invites_sent_to ON invites (sent_to);
CREATE INDEX IF NOT EXISTS idx_invites_sent_from ON invites (sent_from);
CREATE INDEX IF NOT EXISTS idx_invites_project_id ON invites (project_id);
