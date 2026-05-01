-- Default canvas size for new projects (720p landscape)
ALTER TABLE projects ALTER COLUMN width SET DEFAULT 1280;
ALTER TABLE projects ALTER COLUMN height SET DEFAULT 720;
