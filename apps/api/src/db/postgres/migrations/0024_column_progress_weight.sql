-- T66 — peso de avanço por coluna (change progresso-por-coluna-e-ajustes-dashboard).
-- Equivalente PostgreSQL de 0051_column_progress_weight.sql.
-- Nulo significa "derivado"; a faixa 0–100 é validada na API.
ALTER TABLE columns ADD COLUMN IF NOT EXISTS progress_weight integer;
