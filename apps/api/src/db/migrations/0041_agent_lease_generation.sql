-- Migration: geração monotônica de lease do worker do agente (T37)
-- [DB-SWAP] Equivalente PostgreSQL em 0012_agent_lease_generation.sql.
-- Fencing: incrementa a cada aquisição (claim) para invalidar escritas de
-- gerações antigas após recuperação por outro worker.
ALTER TABLE `assistant_runs` ADD COLUMN `lease_generation` integer DEFAULT 0 NOT NULL;
