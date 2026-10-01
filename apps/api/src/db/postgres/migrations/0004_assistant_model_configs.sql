CREATE TABLE assistant_model_configs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('OPENAI', 'OPENROUTER')),
  model TEXT NOT NULL,
  credential_id TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  validation_status TEXT NOT NULL DEFAULT 'UNVALIDATED'
    CHECK (validation_status IN ('UNVALIDATED', 'VALID', 'INVALID')),
  validated_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT assistant_model_configs_tenant_id_id_unique UNIQUE (tenant_id, id),
  CONSTRAINT assistant_model_configs_credential_tenant_fk
    FOREIGN KEY (tenant_id, credential_id)
    REFERENCES assistant_credentials (tenant_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX assistant_model_configs_tenant_position_idx
  ON assistant_model_configs (tenant_id, position);

INSERT INTO assistant_model_configs (
  id, tenant_id, provider, model, credential_id, position, enabled,
  validation_status, validated_at, created_at, updated_at
)
SELECT
  md5(settings.tenant_id || ':azy-agent-primary'), settings.tenant_id,
  settings.provider, settings.model, settings.credential_id, 0,
  (settings.validation_status = 'VALID' AND credentials.revoked_at IS NULL),
  settings.validation_status, settings.validated_at, settings.updated_at, settings.updated_at
FROM assistant_settings AS settings
JOIN assistant_credentials AS credentials
  ON credentials.id = settings.credential_id
 AND credentials.tenant_id = settings.tenant_id
 AND credentials.provider = settings.provider
WHERE settings.credential_id IS NOT NULL
  AND settings.provider IS NOT NULL
  AND settings.model IS NOT NULL;
