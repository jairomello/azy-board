-- T10: metadados humanos opcionais em attachments (label, data de referência, descrição Markdown).
-- NOTA: gerado manualmente a partir do diff drizzle — o snapshot PG anterior estava defasado
-- (migrations 0001–0006 foram escritas à mão sem atualizar o meta/journal), então o
-- drizzle-kit generate produziu catch-up duplicado de 0004–0006. Este arquivo contém APENAS
-- as colunas novas + backfill; o snapshot meta/0001_snapshot.json fica como base correta
-- para gerações futuras.
ALTER TABLE "attachments" ADD COLUMN "label" text;
ALTER TABLE "attachments" ADD COLUMN "reference_date" text;
ALTER TABLE "attachments" ADD COLUMN "description" text;
UPDATE "attachments" SET "label" = "original_name" WHERE "label" IS NULL;
