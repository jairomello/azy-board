-- Migration: contador de recuperação por checkpoint do worker do agente (T37)
-- [DB-SWAP] Equivalente SQLite em 0042_agent_recovery_attempts.sql.
ALTER TABLE assistant_runs ADD COLUMN recovery_attempts integer NOT NULL DEFAULT 0;
