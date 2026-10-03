-- Migration: project-and-item-icons (perfil ADVANCED / PostgreSQL)
-- Campos de aparência (ícone e cor) em projects e items. Aditivo e nullable:
-- null indica "sem personalização" e a apresentação aplica o default.
-- [TENANT] As colunas são lidas sempre com o filtro de tenant_id correspondente.
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "icon" text;
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "color" text;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "icon" text;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "color" text;
