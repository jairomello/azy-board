-- T77 — campos de tokens de IA por card (change add-card-token-tracking).
-- [DB-SWAP] Equivalente PostgreSQL em 0025_item_tokens.sql.
-- O total de tokens é derivado (soma de tokens_input + tokens_output) e não é
-- persistido. O SQLite não permite adicionar CHECK por ALTER TABLE; a
-- não-negatividade é validada na API e no verificador de integridade.
ALTER TABLE `items` ADD COLUMN `tokens_input` integer;--> statement-breakpoint
ALTER TABLE `items` ADD COLUMN `tokens_output` integer;
