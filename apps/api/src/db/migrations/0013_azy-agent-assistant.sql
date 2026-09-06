-- Azy Agent: migration additive, sem credenciais ativas ou conteúdo legado.
-- [TENANT] Toda tabela inclui tenant_id e consultas devem filtrar esse escopo.
-- [PRIVACY] ciphertext é opaco e deve ser cifrado pelo serviço antes de inserir.
CREATE TABLE IF NOT EXISTS assistant_credentials (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  credential_mode TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  ciphertext_version INTEGER NOT NULL DEFAULT 1,
  key_prefix TEXT,
  scopes_json TEXT NOT NULL DEFAULT '[]',
  expires_at TEXT,
  revoked_at TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS assistant_settings (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 0,
  provider TEXT,
  model TEXT,
  credential_mode TEXT,
  credential_id TEXT REFERENCES assistant_credentials(id),
  validation_status TEXT NOT NULL DEFAULT 'UNVALIDATED',
  validated_at TEXT,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS assistant_conversations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  project_id TEXT REFERENCES projects(id),
  title TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS assistant_messages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS assistant_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  credential_id TEXT REFERENCES assistant_credentials(id),
  model TEXT,
  status TEXT NOT NULL DEFAULT 'QUEUED',
  idempotency_key TEXT,
  current_cursor INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_micros INTEGER,
  error_code TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  expires_at TEXT
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS assistant_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL REFERENCES assistant_runs(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS assistant_tool_calls (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL REFERENCES assistant_runs(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  arguments_json TEXT NOT NULL DEFAULT '{}',
  result_summary TEXT,
  operation_hash TEXT,
  idempotency_key TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS assistant_approvals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL REFERENCES assistant_runs(id) ON DELETE CASCADE,
  tool_call_id TEXT REFERENCES assistant_tool_calls(id),
  status TEXT NOT NULL DEFAULT 'PENDING',
  preview_json TEXT NOT NULL,
  operation_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  decided_by TEXT REFERENCES users(id),
  decided_at TEXT,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS assistant_credentials_tenant_active_idx ON assistant_credentials(tenant_id, revoked_at, expires_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS assistant_conversations_tenant_user_updated_idx ON assistant_conversations(tenant_id, user_id, updated_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS assistant_messages_tenant_conversation_created_idx ON assistant_messages(tenant_id, conversation_id, created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS assistant_runs_tenant_conversation_status_idx ON assistant_runs(tenant_id, conversation_id, status);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS assistant_runs_tenant_user_idempotency_unique ON assistant_runs(tenant_id, user_id, idempotency_key);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS assistant_events_tenant_run_sequence_unique ON assistant_events(tenant_id, run_id, sequence);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS assistant_events_tenant_run_created_idx ON assistant_events(tenant_id, run_id, created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS assistant_tool_calls_tenant_run_created_idx ON assistant_tool_calls(tenant_id, run_id, created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS assistant_tool_calls_tenant_operation_hash_idx ON assistant_tool_calls(tenant_id, operation_hash);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS assistant_approvals_tenant_status_expiry_idx ON assistant_approvals(tenant_id, status, expires_at);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS assistant_approvals_tenant_operation_hash_unique ON assistant_approvals(tenant_id, operation_hash);
--> statement-breakpoint
-- Existing tenants get an explicit disabled row. No credentials or conversations are created.
INSERT OR IGNORE INTO assistant_settings(tenant_id, enabled, validation_status, updated_at)
SELECT id, 0, 'UNVALIDATED', strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM tenants;
