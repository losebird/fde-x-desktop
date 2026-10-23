CREATE TABLE task_ai_runs_completed (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('running', 'cancelled', 'ready', 'completed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

INSERT INTO task_ai_runs_completed
  (id, task_id, session_id, request_id, state, created_at, updated_at)
SELECT id, task_id, session_id, request_id, state, created_at, updated_at
FROM task_ai_runs;

DROP TABLE task_ai_runs;

ALTER TABLE task_ai_runs_completed RENAME TO task_ai_runs;

CREATE INDEX idx_task_ai_runs_task ON task_ai_runs(task_id, created_at DESC);
