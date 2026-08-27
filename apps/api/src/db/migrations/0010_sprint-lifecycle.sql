-- [DB-SWAP] PostgreSQL deve usar UPDATE equivalente dentro de uma migration transacional.
-- [TENANT] Apenas valores da tabela sprints são transformados; IDs, vínculos e tenant_id permanecem intactos.
UPDATE sprints SET status = 'PROPOSED' WHERE status = 'PLANNED';
UPDATE sprints SET status = 'OPEN' WHERE status = 'ACTIVE';
UPDATE sprints SET status = 'CLOSED' WHERE status = 'DONE';
-- Datas eram opcionais no modelo anterior. Para preservar registros, usa-se created_at como fallback.
UPDATE sprints SET start_date = COALESCE(start_date, substr(created_at, 1, 10)), end_date = COALESCE(end_date, substr(created_at, 1, 10)) WHERE start_date IS NULL OR end_date IS NULL;
