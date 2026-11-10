-- 0030: status base PLANNED (coluna "Planejado"/"A Fazer").
-- Separa o trabalho priorizado do backlog ainda não priorizado. Mesmo peso de
-- avanço de NOT_STARTED; a ordem visual é dada pela posição da coluna.
-- Equivalente SQLite: o perfil SIMPLE guarda status como texto livre, sem CHECK,
-- então não há migration equivalente.
ALTER TABLE "columns" DROP CONSTRAINT IF EXISTS "columns_base_status_check";
ALTER TABLE "columns" ADD CONSTRAINT "columns_base_status_check"
  CHECK ("base_status" IN ('NOT_STARTED','PLANNED','IN_PROGRESS','BLOCKED','DONE','CANCELLED'));

ALTER TABLE "items" DROP CONSTRAINT IF EXISTS "items_status_check";
ALTER TABLE "items" ADD CONSTRAINT "items_status_check"
  CHECK ("status" IN ('NOT_STARTED','PLANNED','IN_PROGRESS','BLOCKED','DONE','CANCELLED','ARCHIVED'));

ALTER TABLE "items" DROP CONSTRAINT IF EXISTS "items_status_before_archive_check";
ALTER TABLE "items" ADD CONSTRAINT "items_status_before_archive_check"
  CHECK ("status_before_archive" IS NULL OR "status_before_archive" IN ('NOT_STARTED','PLANNED','IN_PROGRESS','BLOCKED','DONE','CANCELLED'));
