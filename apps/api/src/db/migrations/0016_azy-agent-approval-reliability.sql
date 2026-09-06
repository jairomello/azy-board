DROP INDEX IF EXISTS assistant_approvals_tenant_operation_hash_unique;
CREATE UNIQUE INDEX IF NOT EXISTS assistant_approvals_run_operation_hash_unique
ON assistant_approvals(tenant_id, run_id, operation_hash);

UPDATE assistant_settings SET max_output_tokens = 4000 WHERE max_output_tokens = 2000;
UPDATE assistant_settings SET timeout_ms = 90000 WHERE timeout_ms = 45000;
