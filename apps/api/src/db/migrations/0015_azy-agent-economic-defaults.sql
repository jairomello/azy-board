-- Atualiza somente o perfil legado padrão da migration 0014.
UPDATE assistant_settings
SET requests_per_minute = 10, max_active_per_user = 1, max_active_per_tenant = 3,
    daily_budget_micros = 100000, tenant_daily_budget_micros = 1000000,
    max_steps = 4, max_tool_calls = 8, max_input_tokens = 8000,
    max_output_tokens = 2000, max_payload_bytes = 50000, timeout_ms = 45000
WHERE requests_per_minute = 20 AND max_active_per_user = 2 AND max_active_per_tenant = 10
  AND daily_budget_micros = 2000000 AND tenant_daily_budget_micros = 10000000
  AND max_steps = 8 AND max_tool_calls = 20 AND max_input_tokens = 16000
  AND max_output_tokens = 8000 AND max_payload_bytes = 100000 AND timeout_ms = 60000;
