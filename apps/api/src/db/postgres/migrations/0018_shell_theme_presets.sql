-- Migration: shell-theme-presets (perfil ADVANCED / PostgreSQL)
-- Amplia o CHECK de presets do shell claro com ruby, amber, amethyst, rose e silver.
-- Aditivo: nenhum valor existente é removido; `petroleum` segue padrão e fallback.
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_shell_theme_check";
ALTER TABLE "users" ADD CONSTRAINT "users_shell_theme_check" CHECK ("users"."light_shell_theme" IN ('petroleum','ocean','emerald','graphite','classic','ruby','amber','amethyst','rose','silver'));
