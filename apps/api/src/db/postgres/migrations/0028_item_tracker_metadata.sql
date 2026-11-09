-- 0028: metadados de rastreio do tracker no item (ADVANCED/PostgreSQL).
-- Aditivo: chave externa (planilha/Jira), responsável externo e datas de
-- acompanhamento (realizadas e baseline). Nenhum dado existente é reescrito.
ALTER TABLE "items" ADD COLUMN "external_source" text;
ALTER TABLE "items" ADD COLUMN "external_ref" text;
ALTER TABLE "items" ADD COLUMN "assignee_label" text;
ALTER TABLE "items" ADD COLUMN "actual_start_date" text;
ALTER TABLE "items" ADD COLUMN "actual_due_date" text;
ALTER TABLE "items" ADD COLUMN "baseline_start_date" text;
ALTER TABLE "items" ADD COLUMN "baseline_due_date" text;

CREATE UNIQUE INDEX "items_external_ref_unique"
  ON "items" ("tenant_id", "project_id", "external_source", "external_ref")
  WHERE "external_ref" IS NOT NULL;
CREATE INDEX "items_external_ref_idx"
  ON "items" ("tenant_id", "project_id", "external_source", "external_ref");

ALTER TABLE "items" ADD CONSTRAINT "items_external_pair_check"
  CHECK (("external_source" IS NULL AND "external_ref" IS NULL)
      OR ("external_source" IS NOT NULL AND "external_ref" IS NOT NULL));
ALTER TABLE "items" ADD CONSTRAINT "items_actual_dates_check"
  CHECK ("actual_start_date" IS NULL OR "actual_due_date" IS NULL OR "actual_due_date" >= "actual_start_date");
ALTER TABLE "items" ADD CONSTRAINT "items_baseline_dates_check"
  CHECK ("baseline_start_date" IS NULL OR "baseline_due_date" IS NULL OR "baseline_due_date" >= "baseline_start_date");
