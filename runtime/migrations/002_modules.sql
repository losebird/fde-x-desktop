PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ai_agents (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused')),
  model_route TEXT,
  system_prompt TEXT,
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS ai_conversations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_id TEXT REFERENCES ai_agents(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  source_ref TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS ai_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content_json TEXT NOT NULL,
  source_ref TEXT,
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_time ON ai_messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS ai_runs (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES actors(id) ON DELETE SET NULL,
  state TEXT NOT NULL CHECK (state IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  request_json TEXT NOT NULL,
  result_json TEXT,
  correlation_id TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS ai_run_steps (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES ai_runs(id) ON DELETE CASCADE,
  sequence_no INTEGER NOT NULL CHECK (sequence_no >= 0),
  step_type TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('queued', 'running', 'succeeded', 'failed', 'skipped', 'cancelled')),
  input_json TEXT NOT NULL DEFAULT '{}',
  output_json TEXT,
  error_json TEXT,
  started_at TEXT,
  finished_at TEXT,
  UNIQUE (run_id, sequence_no)
) STRICT;

CREATE TABLE IF NOT EXISTS im_contacts (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  handle TEXT,
  contact_type TEXT NOT NULL CHECK (contact_type IN ('person', 'group', 'service')),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS im_threads (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
  contact_id TEXT REFERENCES im_contacts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  thread_type TEXT NOT NULL CHECK (thread_type IN ('direct', 'group', 'topic')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS im_topics (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES im_threads(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_by TEXT REFERENCES actors(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS im_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES im_threads(id) ON DELETE CASCADE,
  topic_id TEXT REFERENCES im_topics(id) ON DELETE SET NULL,
  author_ref TEXT NOT NULL,
  reply_to_id TEXT REFERENCES im_messages(id) ON DELETE SET NULL,
  body_json TEXT NOT NULL,
  delivery_state TEXT NOT NULL DEFAULT 'local' CHECK (delivery_state IN ('local', 'queued', 'sent', 'delivered', 'read', 'failed', 'recalled')),
  external_receipt_ref TEXT,
  sent_at TEXT NOT NULL,
  recalled_at TEXT
) STRICT;

CREATE INDEX IF NOT EXISTS idx_im_messages_thread_time ON im_messages(thread_id, sent_at);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('todo', 'doing', 'done', 'archived')),
  priority TEXT NOT NULL CHECK (priority IN ('low', 'med', 'high', 'urgent')),
  due_at TEXT,
  completed_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  location TEXT,
  event_kind TEXT NOT NULL CHECK (event_kind IN ('meeting', 'focus', 'reminder', 'external')),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (end_at >= start_at)
) STRICT;

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  subject_ref TEXT NOT NULL,
  remind_at TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'scheduled' CHECK (state IN ('scheduled', 'fired', 'dismissed', 'cancelled')),
  channel_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'archived')),
  trigger_json TEXT NOT NULL,
  definition_json TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  state TEXT NOT NULL CHECK (state IN ('queued', 'running', 'waiting', 'succeeded', 'failed', 'cancelled')),
  trigger_json TEXT NOT NULL,
  input_json TEXT NOT NULL DEFAULT '{}',
  output_json TEXT,
  correlation_id TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS workflow_run_steps (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  sequence_no INTEGER NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('queued', 'running', 'waiting', 'succeeded', 'failed', 'skipped', 'cancelled')),
  input_json TEXT NOT NULL DEFAULT '{}',
  output_json TEXT,
  error_json TEXT,
  started_at TEXT,
  finished_at TEXT,
  UNIQUE (run_id, step_key)
) STRICT;

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES files(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_kind TEXT NOT NULL,
  media_type TEXT,
  storage_uri TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  current_version_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS file_versions (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL CHECK (version_no > 0),
  content_uri TEXT,
  content_hash TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  note TEXT,
  created_by TEXT REFERENCES actors(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  UNIQUE (file_id, version_no)
) STRICT;

CREATE TABLE IF NOT EXISTS mcp_servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  transport TEXT NOT NULL CHECK (transport IN ('stdio', 'http', 'sse', 'other')),
  status TEXT NOT NULL CHECK (status IN ('connected', 'disconnected', 'pending', 'error')),
  config_json TEXT NOT NULL DEFAULT '{}',
  last_health_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS tools (
  id TEXT PRIMARY KEY,
  server_id TEXT REFERENCES mcp_servers(id) ON DELETE CASCADE,
  canonical_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  input_schema_json TEXT NOT NULL DEFAULT '{}',
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  UNIQUE (server_id, canonical_name)
) STRICT;

CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL CHECK (source IN ('builtin', 'user', 'marketplace', 'project')),
  version TEXT,
  status TEXT NOT NULL CHECK (status IN ('enabled', 'disabled', 'invalid', 'missing')),
  manifest_json TEXT NOT NULL DEFAULT '{}',
  installed_at TEXT,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS agent_skills (
  agent_id TEXT NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  config_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (agent_id, skill_id)
) STRICT;

CREATE TABLE IF NOT EXISTS briefing_definitions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'archived')),
  sources_json TEXT NOT NULL DEFAULT '[]',
  sections_json TEXT NOT NULL DEFAULT '[]',
  filters_json TEXT NOT NULL DEFAULT '{}',
  schedule_json TEXT,
  delivery_json TEXT NOT NULL DEFAULT '{}',
  template_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS briefings (
  id TEXT PRIMARY KEY,
  definition_id TEXT NOT NULL REFERENCES briefing_definitions(id) ON DELETE CASCADE,
  state TEXT NOT NULL CHECK (state IN ('queued', 'generating', 'ready', 'failed')),
  content_json TEXT,
  artifact_ref TEXT,
  generated_at TEXT,
  created_at TEXT NOT NULL
) STRICT;
