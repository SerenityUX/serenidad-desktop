-- Per-project visual style (e.g. "Ghibli/Miyazaki", "Moebius",
-- "Makoto Shinkai"). Appended to every generation prompt so the whole
-- storyboard stays visually consistent.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS style TEXT NOT NULL DEFAULT 'Ghibli/Miyazaki';
