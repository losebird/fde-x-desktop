CREATE TABLE IF NOT EXISTS workspace_file_revisions (
  id TEXT PRIMARY KEY,
  cwd TEXT NOT NULL,
  rel_path TEXT NOT NULL,
  version_no INTEGER NOT NULL CHECK (version_no > 0),
  note TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  sha256 TEXT NOT NULL,
  blob_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (cwd, rel_path, version_no)
) STRICT;

CREATE INDEX IF NOT EXISTS workspace_file_revisions_path
  ON workspace_file_revisions (cwd, rel_path, version_no DESC);
