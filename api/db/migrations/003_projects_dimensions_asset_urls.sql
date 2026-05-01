-- Dimensions for editor canvas / export
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS width INTEGER NOT NULL DEFAULT 1920,
  ADD COLUMN IF NOT EXISTS height INTEGER NOT NULL DEFAULT 1080;

-- Asset columns store HTTPS URLs (e.g. presigned or public S3 URLs), not local paths
COMMENT ON COLUMN users.profile_picture IS 'URL of profile image (typically S3/HTTPS)';
COMMENT ON COLUMN projects.thumbnail IS 'URL of project thumbnail image (typically S3/HTTPS)';
COMMENT ON COLUMN frames.result IS 'URL of rendered frame/media asset (typically S3/HTTPS)';
