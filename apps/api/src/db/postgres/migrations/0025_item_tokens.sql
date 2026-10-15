-- T77 — campos de tokens de IA por card (change add-card-token-tracking).
-- Equivalente PostgreSQL de 0052_item_tokens.sql.
-- O total de tokens é derivado (soma) e não é persistido.
ALTER TABLE items ADD COLUMN IF NOT EXISTS tokens_input integer;
ALTER TABLE items ADD COLUMN IF NOT EXISTS tokens_output integer;
ALTER TABLE items ADD CONSTRAINT items_tokens_input_check CHECK (tokens_input IS NULL OR tokens_input >= 0);
ALTER TABLE items ADD CONSTRAINT items_tokens_output_check CHECK (tokens_output IS NULL OR tokens_output >= 0);
