-- [DB-SWAP] PostgreSQL adapter should use the equivalent enum migration.
ALTER TABLE users ADD COLUMN global_group TEXT NOT NULL DEFAULT 'TEAM_MEMBER';
