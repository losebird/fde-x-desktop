PRAGMA foreign_keys = ON;

-- Event bus envelope fields (spec 01); existing outbox columns unchanged.
ALTER TABLE outbox_events ADD COLUMN ts INTEGER;
ALTER TABLE outbox_events ADD COLUMN workspace_cwd TEXT;
ALTER TABLE outbox_events ADD COLUMN session_id TEXT;
ALTER TABLE outbox_events ADD COLUMN source TEXT NOT NULL DEFAULT 'bff';
ALTER TABLE outbox_events ADD COLUMN delivered INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_outbox_ts ON outbox_events(ts);
CREATE INDEX IF NOT EXISTS idx_outbox_ws ON outbox_events(workspace_cwd, ts);
