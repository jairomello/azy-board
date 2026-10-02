ALTER TABLE attachments
  ADD COLUMN storage_provider text NOT NULL DEFAULT 'local';

CREATE TABLE tenant_attachment_settings (
  tenant_id text PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  provider text NOT NULL DEFAULT 'local',
  endpoint text,
  region text,
  bucket text,
  prefix text,
  access_key_id text,
  secret_ciphertext text,
  secret_version integer,
  updated_at text NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  CONSTRAINT tenant_attachment_settings_provider_check CHECK (provider IN ('local', 's3'))
);
