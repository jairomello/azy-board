-- Migration: contador de recuperação por checkpoint do worker do agente (T37)
-- [DB-SWAP] Equivalente PostgreSQL em 0013_agent_recovery_attempts.sql.
-- Separa o budget de recuperação (3 aquisições sem progresso confirmado) do
-- contador histórico `attempts`; reinicia quando um checkpoint é persistido.
ALTER TABLE `assistant_runs` ADD COLUMN `recovery_attempts` integer DEFAULT 0 NOT NULL;
