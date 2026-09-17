-- Briefing run metadata (spec 06); idempotent adds.

ALTER TABLE briefings ADD COLUMN workspace_cwd TEXT;
ALTER TABLE briefings ADD COLUMN agent_request_id TEXT;

CREATE INDEX IF NOT EXISTS idx_briefings_workspace_cwd ON briefings(workspace_cwd);
CREATE INDEX IF NOT EXISTS idx_briefings_agent_request ON briefings(agent_request_id);
