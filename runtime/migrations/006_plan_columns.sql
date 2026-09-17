ALTER TABLE tasks ADD COLUMN source_ref TEXT;
ALTER TABLE tasks ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]';

ALTER TABLE calendar_events ADD COLUMN source_ref TEXT;
ALTER TABLE calendar_events ADD COLUMN all_day INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_tasks_workspace_status ON tasks(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_calendar_events_workspace_start ON calendar_events(workspace_id, start_at);
