-- Migration: geração monotônica de lease do worker do agente (T37)
-- [DB-SWAP] Equivalente SQLite em 0041_agent_lease_generation.sql.
ALTER TABLE assistant_runs ADD COLUMN lease_generation integer NOT NULL DEFAULT 0;
