ALTER TABLE calendar_events ADD COLUMN workflow_id TEXT;
ALTER TABLE calendar_events ADD COLUMN recurrence TEXT;
ALTER TABLE workflow_runs ADD COLUMN schedule_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_runs_schedule_key ON workflow_runs(schedule_key);
