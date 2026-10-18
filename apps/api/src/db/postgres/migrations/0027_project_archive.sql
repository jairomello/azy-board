-- T81 — equivalente PostgreSQL de 0054_project-archive.sql.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
