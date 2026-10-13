-- Card T61 — opções de ocultar módulos/épicos em projetos hierárquicos.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS hide_modules boolean NOT NULL DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS hide_epics boolean NOT NULL DEFAULT false;
