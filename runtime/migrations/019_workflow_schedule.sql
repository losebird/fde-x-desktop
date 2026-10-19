ALTER TABLE calendar_events ADD COLUMN workflow_id TEXT;
ALTER TABLE calendar_events ADD COLUMN recurrence TEXT;
ALTER TABLE workflow_runs ADD COLUMN schedule_key TEXT;
