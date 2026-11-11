-- 0031: status base IN_HOMOLOGATION (coluna "Em Homologação").
-- A entrega está pronta e aguarda o aceite de quem pediu: o desenvolvimento terminou,
-- mas o card ainda não está concluído. Participa da faixa do fluxo (não do DONE), então
-- costuma ser a última coluna antes de "Concluídas".
-- Equivalente SQLite: o perfil SIMPLE guarda status como texto livre, sem CHECK,
-- então não há migration equivalente.
ALTER TABLE "columns" DROP CONSTRAINT IF EXISTS "columns_base_status_check";
ALTER TABLE "columns" ADD CONSTRAINT "columns_base_status_check"
  CHECK ("base_status" IN ('NOT_STARTED','PLANNED','IN_PROGRESS','IN_HOMOLOGATION','BLOCKED','DONE','CANCELLED'));

ALTER TABLE "items" DROP CONSTRAINT IF EXISTS "items_status_check";
ALTER TABLE "items" ADD CONSTRAINT "items_status_check"
  CHECK ("status" IN ('NOT_STARTED','PLANNED','IN_PROGRESS','IN_HOMOLOGATION','BLOCKED','DONE','CANCELLED','ARCHIVED'));

ALTER TABLE "items" DROP CONSTRAINT IF EXISTS "items_status_before_archive_check";
ALTER TABLE "items" ADD CONSTRAINT "items_status_before_archive_check"
  CHECK ("status_before_archive" IS NULL OR "status_before_archive" IN ('NOT_STARTED','PLANNED','IN_PROGRESS','IN_HOMOLOGATION','BLOCKED','DONE','CANCELLED'));
