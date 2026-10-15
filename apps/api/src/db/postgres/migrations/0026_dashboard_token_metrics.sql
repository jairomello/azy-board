-- T80 — recortes e série de tokens de IA no Dashboard.
-- Equivalente PostgreSQL de 0053_dashboard_token_metrics.sql.
-- O evento TOKENS_CHANGED exige recriar o CHECK de item_events.event_type.
ALTER TABLE project_metrics_daily ADD COLUMN IF NOT EXISTS tokens_input integer NOT NULL DEFAULT 0;
ALTER TABLE project_metrics_daily ADD COLUMN IF NOT EXISTS tokens_output integer NOT NULL DEFAULT 0;
ALTER TABLE project_metrics_daily ADD COLUMN IF NOT EXISTS done_tokens_input integer NOT NULL DEFAULT 0;
ALTER TABLE project_metrics_daily ADD COLUMN IF NOT EXISTS done_tokens_output integer NOT NULL DEFAULT 0;

ALTER TABLE project_analytics_dimension_state ADD COLUMN IF NOT EXISTS tokens_input integer NOT NULL DEFAULT 0;
ALTER TABLE project_analytics_dimension_state ADD COLUMN IF NOT EXISTS tokens_output integer NOT NULL DEFAULT 0;
ALTER TABLE project_analytics_dimension_state ADD COLUMN IF NOT EXISTS done_tokens_input integer NOT NULL DEFAULT 0;
ALTER TABLE project_analytics_dimension_state ADD COLUMN IF NOT EXISTS done_tokens_output integer NOT NULL DEFAULT 0;

ALTER TABLE project_analytics_dimension_snapshots ADD COLUMN IF NOT EXISTS tokens_input integer NOT NULL DEFAULT 0;
ALTER TABLE project_analytics_dimension_snapshots ADD COLUMN IF NOT EXISTS tokens_output integer NOT NULL DEFAULT 0;
ALTER TABLE project_analytics_dimension_snapshots ADD COLUMN IF NOT EXISTS done_tokens_input integer NOT NULL DEFAULT 0;
ALTER TABLE project_analytics_dimension_snapshots ADD COLUMN IF NOT EXISTS done_tokens_output integer NOT NULL DEFAULT 0;

ALTER TABLE item_events DROP CONSTRAINT IF EXISTS item_events_event_type_check;
ALTER TABLE item_events ADD CONSTRAINT item_events_event_type_check CHECK (event_type IN ('ANALYTICS_BASELINE','ITEM_CREATED','STATUS_CHANGED','POINTS_CHANGED','TYPE_CHANGED','SPRINT_CHANGED','VERSION_CHANGED','ITEM_REPARENTED','MODULE_CHANGED','LEAF_CHANGED','ITEM_ARCHIVED','ITEM_UNARCHIVED','ITEM_DELETED','TOKENS_CHANGED'));
