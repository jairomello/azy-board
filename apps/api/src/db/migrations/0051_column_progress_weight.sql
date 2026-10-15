-- T66 — peso de avanço por coluna (change progresso-por-coluna-e-ajustes-dashboard).
-- [DB-SWAP] Equivalente PostgreSQL em 0024_column_progress_weight.sql.
-- Nulo significa "derivado": o peso efetivo é calculado a partir do base_status e da
-- posição entre as colunas do mesmo status (packages/domain/src/progress.ts). A faixa
-- 0–100 é validada na API; o SQLite não permite adicionar CHECK por ALTER TABLE.
ALTER TABLE `columns` ADD COLUMN `progress_weight` integer;
