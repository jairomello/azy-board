-- 0028: metadados de rastreio do tracker no item (ADVANCED/PostgreSQL).
-- Aditivo: chave externa informativa (planilha/Jira), responsável externo e
-- datas realizadas. Nenhum dado existente é reescrito. A chave externa é
-- apenas informativa; não há índice único nem upsert por chave.
ALTER TABLE "items" ADD COLUMN "external_source" text;
ALTER TABLE "items" ADD COLUMN "external_ref" text;
ALTER TABLE "items" ADD COLUMN "assignee_label" text;
ALTER TABLE "items" ADD COLUMN "actual_start_date" text;
ALTER TABLE "items" ADD COLUMN "actual_due_date" text;

ALTER TABLE "items" ADD CONSTRAINT "items_actual_dates_check"
  CHECK ("actual_start_date" IS NULL OR "actual_due_date" IS NULL OR "actual_due_date" >= "actual_start_date");
