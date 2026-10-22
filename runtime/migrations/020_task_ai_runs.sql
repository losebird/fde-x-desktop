CREATE TABLE IF NOT EXISTS task_ai_runs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('running', 'cancelled', 'ready')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS idx_task_ai_runs_task ON task_ai_runs(task_id, created_at DESC);
