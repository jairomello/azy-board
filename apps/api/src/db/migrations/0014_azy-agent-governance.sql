-- Azy Agent: limites operacionais configuraveis por tenant, mantendo defaults seguros.
ALTER TABLE assistant_settings ADD COLUMN requests_per_minute INTEGER NOT NULL DEFAULT 10;
--> statement-breakpoint
ALTER TABLE assistant_settings ADD COLUMN max_active_per_user INTEGER NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE assistant_settings ADD COLUMN max_active_per_tenant INTEGER NOT NULL DEFAULT 3;
--> statement-breakpoint
ALTER TABLE assistant_settings ADD COLUMN daily_budget_micros INTEGER NOT NULL DEFAULT 100000;
--> statement-breakpoint
ALTER TABLE assistant_settings ADD COLUMN tenant_daily_budget_micros INTEGER NOT NULL DEFAULT 1000000;
--> statement-breakpoint
ALTER TABLE assistant_settings ADD COLUMN max_steps INTEGER NOT NULL DEFAULT 4;
--> statement-breakpoint
ALTER TABLE assistant_settings ADD COLUMN max_tool_calls INTEGER NOT NULL DEFAULT 8;
--> statement-breakpoint
ALTER TABLE assistant_settings ADD COLUMN max_input_tokens INTEGER NOT NULL DEFAULT 8000;
--> statement-breakpoint
ALTER TABLE assistant_settings ADD COLUMN max_output_tokens INTEGER NOT NULL DEFAULT 2000;
--> statement-breakpoint
ALTER TABLE assistant_settings ADD COLUMN max_payload_bytes INTEGER NOT NULL DEFAULT 50000;
--> statement-breakpoint
ALTER TABLE assistant_settings ADD COLUMN timeout_ms INTEGER NOT NULL DEFAULT 45000;
