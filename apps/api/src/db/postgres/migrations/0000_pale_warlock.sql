CREATE TABLE IF NOT EXISTS "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"ai_model_name" text,
	"project_scope" text,
	"permission_scope" text,
	"expires_at" text,
	"revoked_at" text,
	"created_at" text DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) NOT NULL,
	"last_used_at" text,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assistant_approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"run_id" text NOT NULL,
	"tool_call_id" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"preview_json" text NOT NULL,
	"operation_hash" text NOT NULL,
	"expires_at" text NOT NULL,
	"decided_by" text,
	"decided_at" text,
	"created_at" text NOT NULL,
	CONSTRAINT "assistant_approvals_status_check" CHECK ("assistant_approvals"."status" IN ('PENDING','APPROVED','REJECTED','EXPIRED','CANCELLED'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assistant_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text,
	"title" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assistant_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"provider" text NOT NULL,
	"credential_mode" text NOT NULL,
	"ciphertext" text NOT NULL,
	"ciphertext_version" integer DEFAULT 1 NOT NULL,
	"key_prefix" text,
	"scopes_json" text DEFAULT '[]' NOT NULL,
	"expires_at" text,
	"revoked_at" text,
	"created_by" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "assistant_credentials_provider_check" CHECK ("assistant_credentials"."provider" IN ('OPENAI','OPENROUTER')),
	CONSTRAINT "assistant_credentials_mode_check" CHECK ("assistant_credentials"."credential_mode" IN ('API_KEY'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assistant_events" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"run_id" text NOT NULL,
	"sequence" integer NOT NULL,
	"event_type" text NOT NULL,
	"payload_json" text DEFAULT '{}' NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "assistant_events_event_type_check" CHECK ("assistant_events"."event_type" IN ('RUN_CREATED','RUN_STARTED','TEXT_DELTA','TOOL_STARTED','TOOL_COMPLETED','QUESTION','APPROVAL_REQUIRED','APPROVAL_DECIDED','RUN_FAILED','RUN_CANCELLED','RUN_COMPLETED'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assistant_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"conversation_id" text NOT NULL,
	"user_id" text,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"metadata_json" text,
	"created_at" text NOT NULL,
	CONSTRAINT "assistant_messages_role_check" CHECK ("assistant_messages"."role" IN ('USER','ASSISTANT','SYSTEM','TOOL'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assistant_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"conversation_id" text NOT NULL,
	"user_id" text NOT NULL,
	"credential_id" text,
	"model" text,
	"status" text DEFAULT 'QUEUED' NOT NULL,
	"idempotency_key" text,
	"current_cursor" integer DEFAULT 0 NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_micros" integer,
	"error_code" text,
	"created_at" text NOT NULL,
	"started_at" text,
	"finished_at" text,
	"expires_at" text,
	CONSTRAINT "assistant_runs_status_check" CHECK ("assistant_runs"."status" IN ('QUEUED','RUNNING','WAITING_USER','WAITING_APPROVAL','COMPLETED','FAILED','CANCELLED','EXPIRED'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assistant_settings" (
	"tenant_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"provider" text,
	"model" text,
	"credential_mode" text,
	"credential_id" text,
	"validation_status" text DEFAULT 'UNVALIDATED' NOT NULL,
	"validated_at" text,
	"requests_per_minute" integer DEFAULT 10 NOT NULL,
	"max_active_per_user" integer DEFAULT 1 NOT NULL,
	"max_active_per_tenant" integer DEFAULT 3 NOT NULL,
	"daily_budget_micros" integer DEFAULT 100000 NOT NULL,
	"tenant_daily_budget_micros" integer DEFAULT 1000000 NOT NULL,
	"max_steps" integer DEFAULT 4 NOT NULL,
	"max_tool_calls" integer DEFAULT 8 NOT NULL,
	"max_input_tokens" integer DEFAULT 65000 NOT NULL,
	"max_output_tokens" integer DEFAULT 4000 NOT NULL,
	"max_payload_bytes" integer DEFAULT 50000 NOT NULL,
	"timeout_ms" integer DEFAULT 90000 NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "assistant_settings_provider_check" CHECK ("assistant_settings"."provider" IS NULL OR "assistant_settings"."provider" IN ('OPENAI','OPENROUTER')),
	CONSTRAINT "assistant_settings_validation_check" CHECK ("assistant_settings"."validation_status" IN ('UNVALIDATED','VALID','INVALID'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assistant_tool_calls" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"run_id" text NOT NULL,
	"tool_name" text NOT NULL,
	"risk_level" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"arguments_json" text DEFAULT '{}' NOT NULL,
	"result_summary" text,
	"operation_hash" text,
	"idempotency_key" text,
	"created_at" text NOT NULL,
	"started_at" text,
	"finished_at" text,
	CONSTRAINT "assistant_tool_calls_risk_level_check" CHECK ("assistant_tool_calls"."risk_level" IN ('READ','LOW','MEDIUM','HIGH','DESTRUCTIVE')),
	CONSTRAINT "assistant_tool_calls_status_check" CHECK ("assistant_tool_calls"."status" IN ('PENDING','WAITING_APPROVAL','RUNNING','COMPLETED','FAILED','REJECTED','CANCELLED'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"item_id" text NOT NULL,
	"filename" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"storage_path" text NOT NULL,
	"created_at" text DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) NOT NULL,
	CONSTRAINT "attachments_size_check" CHECK ("attachments"."size" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "checklist_items" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"checklist_id" text NOT NULL,
	"text" text NOT NULL,
	"checked" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"due_date" text,
	"assignee_id" text,
	"description" text,
	CONSTRAINT "checklist_items_position_check" CHECK ("checklist_items"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "checklists" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"item_id" text NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) NOT NULL,
	CONSTRAINT "checklists_position_check" CHECK ("checklists"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "columns" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"base_status" text DEFAULT 'NOT_STARTED' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "columns_position_check" CHECK ("columns"."position" >= 0),
	CONSTRAINT "columns_base_status_check" CHECK ("columns"."base_status" IN ('NOT_STARTED','IN_PROGRESS','BLOCKED','DONE','CANCELLED'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "idempotency_records" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"tool" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"payload_hash" text NOT NULL,
	"response_json" text NOT NULL,
	"created_at" text NOT NULL,
	"expires_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "installation_metadata" (
	"id" integer PRIMARY KEY NOT NULL,
	"instance_id" text NOT NULL,
	"profile" text NOT NULL,
	"database_fingerprint" text NOT NULL,
	"schema_revision" integer NOT NULL,
	"created_at" text DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) NOT NULL,
	CONSTRAINT "installation_metadata_singleton_check" CHECK ("installation_metadata"."id" = 1),
	CONSTRAINT "installation_metadata_profile_check" CHECK ("installation_metadata"."profile" IN ('SIMPLE','ADVANCED')),
	CONSTRAINT "installation_metadata_revision_check" CHECK ("installation_metadata"."schema_revision" >= 1)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "item_events" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"project_id" text NOT NULL,
	"item_id" text,
	"event_type" text NOT NULL,
	"occurred_at" text NOT NULL,
	"sequence" integer NOT NULL,
	"actor_id" text NOT NULL,
	"origin" text NOT NULL,
	"correlation_id" text NOT NULL,
	"before_snapshot" text,
	"after_snapshot" text,
	CONSTRAINT "item_events_event_type_check" CHECK ("item_events"."event_type" IN ('ANALYTICS_BASELINE','ITEM_CREATED','STATUS_CHANGED','POINTS_CHANGED','TYPE_CHANGED','SPRINT_CHANGED','VERSION_CHANGED','ITEM_REPARENTED','MODULE_CHANGED','LEAF_CHANGED','ITEM_ARCHIVED','ITEM_UNARCHIVED','ITEM_DELETED'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "item_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"item_id" text NOT NULL,
	"author_id" text,
	"type" text NOT NULL,
	"actor_type" text DEFAULT 'UNKNOWN' NOT NULL,
	"actor_label" text,
	"source" text DEFAULT 'UNKNOWN' NOT NULL,
	"activity" text NOT NULL,
	"duration_min" integer,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "item_logs_duration_check" CHECK ("item_logs"."duration_min" IS NULL OR "item_logs"."duration_min" >= 0),
	CONSTRAINT "item_logs_type_check" CHECK ("item_logs"."type" IN ('auto','manual')),
	CONSTRAINT "item_logs_actor_type_check" CHECK ("item_logs"."actor_type" IN ('HUMAN','AGENT','SYSTEM','UNKNOWN')),
	CONSTRAINT "item_logs_source_check" CHECK ("item_logs"."source" IN ('REST','MCP','SYSTEM','UNKNOWN'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "item_sprints" (
	"tenant_id" text NOT NULL,
	"item_id" text NOT NULL,
	"sprint_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "item_tags" (
	"tenant_id" text NOT NULL,
	"item_id" text NOT NULL,
	"tag_id" text NOT NULL,
	CONSTRAINT "item_tags_item_id_tag_id_pk" PRIMARY KEY("item_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "items" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"project_id" text NOT NULL,
	"type" text DEFAULT 'TASK' NOT NULL,
	"sequence_code" text,
	"parent_id" text,
	"module_id" text,
	"column_id" text,
	"ancestry_path" text DEFAULT '[]' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"persona" text,
	"goal" text,
	"benefit" text,
	"acceptance_criteria" text,
	"notes" text,
	"status" text DEFAULT 'NOT_STARTED' NOT NULL,
	"status_before_archive" text,
	"cost_center_id" text,
	"priority" text DEFAULT 'MEDIUM' NOT NULL,
	"points" integer,
	"assignee_id" text,
	"assignee_api_key_id" text,
	"blocked_reason" text,
	"position" integer DEFAULT 0 NOT NULL,
	"start_date" text,
	"due_date" text,
	"author_id" text,
	"version_id" text,
	"created_at" text DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) NOT NULL,
	"updated_at" text DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) NOT NULL,
	CONSTRAINT "items_points_check" CHECK ("items"."points" IS NULL OR "items"."points" >= 0),
	CONSTRAINT "items_position_check" CHECK ("items"."position" >= 0),
	CONSTRAINT "items_dates_check" CHECK ("items"."start_date" IS NULL OR "items"."due_date" IS NULL OR "items"."due_date" >= "items"."start_date"),
	CONSTRAINT "items_type_check" CHECK ("items"."type" IN ('EPIC','STORY','TASK','BUG')),
	CONSTRAINT "items_status_check" CHECK ("items"."status" IN ('NOT_STARTED','IN_PROGRESS','BLOCKED','DONE','CANCELLED','ARCHIVED')),
	CONSTRAINT "items_status_before_archive_check" CHECK ("items"."status_before_archive" IS NULL OR "items"."status_before_archive" IN ('NOT_STARTED','IN_PROGRESS','BLOCKED','DONE','CANCELLED')),
	CONSTRAINT "items_priority_check" CHECK ("items"."priority" IN ('LOW','MEDIUM','HIGH','CRITICAL'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "login_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"ip" text NOT NULL,
	"email_canonical" text NOT NULL,
	"outcome" text NOT NULL,
	"created_at" text DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) NOT NULL,
	CONSTRAINT "login_attempts_outcome_check" CHECK ("login_attempts"."outcome" IN ('SUCCESS','FAILURE','THROTTLED'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text NOT NULL,
	"squad_id" text,
	"role" text DEFAULT 'MEMBER' NOT NULL,
	"created_at" text DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) NOT NULL,
	CONSTRAINT "memberships_role_check" CHECK ("memberships"."role" IN ('ADMIN','MEMBER','VIEWER'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "modules" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "modules_position_check" CHECK ("modules"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_analytics_coverage" (
	"project_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"coverage_started_at" text NOT NULL,
	"baseline_event_id" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_cost_centers" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"project_id" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) NOT NULL,
	CONSTRAINT "project_cost_centers_sort_order_check" CHECK ("project_cost_centers"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_metrics_daily" (
	"tenant_id" text NOT NULL,
	"project_id" text NOT NULL,
	"metric_date" text NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"done" integer DEFAULT 0 NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"done_points" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "project_metrics_daily_tenant_id_project_id_metric_date_pk" PRIMARY KEY("tenant_id","project_id","metric_date")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"release_date" text,
	"description" text,
	"status" text DEFAULT 'PLANNED' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "project_versions_position_check" CHECK ("project_versions"."position" >= 0),
	CONSTRAINT "project_versions_status_check" CHECK ("project_versions"."status" IN ('PLANNED','IN_DEV','RELEASED','CANCELLED'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"board_mode" text DEFAULT 'HIERARCHICAL' NOT NULL,
	"simple_story_id" text,
	"manager_user_id" text,
	"is_restricted" boolean DEFAULT false NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"advanced_checklists" boolean DEFAULT false NOT NULL,
	"start_date" text,
	"planned_end_date" text,
	"planned_points" integer,
	"planned_hours" double precision,
	"scope" text,
	"created_at" text DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) NOT NULL,
	CONSTRAINT "projects_board_mode_check" CHECK ("projects"."board_mode" IN ('HIERARCHICAL','SIMPLE')),
	CONSTRAINT "projects_planned_points_check" CHECK ("projects"."planned_points" IS NULL OR "projects"."planned_points" >= 0),
	CONSTRAINT "projects_planned_hours_check" CHECK ("projects"."planned_hours" IS NULL OR "projects"."planned_hours" >= 0),
	CONSTRAINT "projects_planned_dates_check" CHECK ("projects"."start_date" IS NULL OR "projects"."planned_end_date" IS NULL OR "projects"."planned_end_date" >= "projects"."start_date")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sprint_cycle_items" (
	"cycle_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"project_id" text NOT NULL,
	"item_id" text NOT NULL,
	"type" text NOT NULL,
	"is_leaf" boolean NOT NULL,
	"points" integer,
	"status" text NOT NULL,
	"module_id" text,
	"version_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sprint_cycles" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"project_id" text NOT NULL,
	"sprint_id" text NOT NULL,
	"started_at" text NOT NULL,
	"ended_at" text,
	"end_reason" text,
	"source" text NOT NULL,
	CONSTRAINT "sprint_cycles_end_reason_check" CHECK ("sprint_cycles"."end_reason" IS NULL OR "sprint_cycles"."end_reason" IN ('SUSPENDED','CLOSED')),
	CONSTRAINT "sprint_cycles_source_check" CHECK ("sprint_cycles"."source" IN ('OPENED','MIGRATION'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sprints" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'PROPOSED' NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"created_at" text DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) NOT NULL,
	CONSTRAINT "sprints_dates_check" CHECK ("sprints"."end_date" >= "sprints"."start_date"),
	CONSTRAINT "sprints_status_check" CHECK ("sprints"."status" IN ('PROPOSED','OPEN','CLOSED'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "squads" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" text DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "storage_cleanup_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"storage_path" text NOT NULL,
	"resource_type" text DEFAULT 'ATTACHMENT' NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"available_at" text NOT NULL,
	"created_at" text DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) NOT NULL,
	"updated_at" text DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) NOT NULL,
	"completed_at" text,
	CONSTRAINT "storage_cleanup_jobs_attempts_check" CHECK ("storage_cleanup_jobs"."attempts" >= 0),
	CONSTRAINT "storage_cleanup_jobs_resource_type_check" CHECK ("storage_cleanup_jobs"."resource_type" IN ('ATTACHMENT')),
	CONSTRAINT "storage_cleanup_jobs_status_check" CHECK ("storage_cleanup_jobs"."status" IN ('PENDING','DONE','FAILED'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tags" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenants" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" text DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_avatars" (
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"content_hash" text NOT NULL,
	"data" text NOT NULL,
	"updated_at" text DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) NOT NULL,
	CONSTRAINT "user_avatars_tenant_id_user_id_pk" PRIMARY KEY("tenant_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"global_group" text DEFAULT 'TEAM_MEMBER' NOT NULL,
	"avatar_url" text,
	"theme" text DEFAULT 'light' NOT NULL,
	"light_shell_theme" text DEFAULT 'petroleum' NOT NULL,
	"language" text DEFAULT 'pt-BR' NOT NULL,
	"auto_theme_by_time" boolean DEFAULT false NOT NULL,
	"created_at" text DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) NOT NULL,
	CONSTRAINT "users_global_group_check" CHECK ("users"."global_group" IN ('TEAM_MEMBER','MANAGER','ADMIN','ROOT')),
	CONSTRAINT "users_theme_check" CHECK ("users"."theme" IN ('light','dark')),
	CONSTRAINT "users_shell_theme_check" CHECK ("users"."light_shell_theme" IN ('petroleum','ocean','emerald','graphite','classic')),
	CONSTRAINT "users_language_check" CHECK ("users"."language" IN ('pt-BR','en','es'))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assistant_approvals" ADD CONSTRAINT "assistant_approvals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assistant_credentials" ADD CONSTRAINT "assistant_credentials_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assistant_events" ADD CONSTRAINT "assistant_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assistant_runs" ADD CONSTRAINT "assistant_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assistant_settings" ADD CONSTRAINT "assistant_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assistant_tool_calls" ADD CONSTRAINT "assistant_tool_calls_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attachments" ADD CONSTRAINT "attachments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "checklists" ADD CONSTRAINT "checklists_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "columns" ADD CONSTRAINT "columns_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "item_events" ADD CONSTRAINT "item_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "item_events" ADD CONSTRAINT "item_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "item_logs" ADD CONSTRAINT "item_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "item_sprints" ADD CONSTRAINT "item_sprints_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "item_tags" ADD CONSTRAINT "item_tags_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "items" ADD CONSTRAINT "items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "modules" ADD CONSTRAINT "modules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_analytics_coverage" ADD CONSTRAINT "project_analytics_coverage_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_analytics_coverage" ADD CONSTRAINT "project_analytics_coverage_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_cost_centers" ADD CONSTRAINT "project_cost_centers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_metrics_daily" ADD CONSTRAINT "project_metrics_daily_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_metrics_daily" ADD CONSTRAINT "project_metrics_daily_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_versions" ADD CONSTRAINT "project_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projects" ADD CONSTRAINT "projects_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sprint_cycle_items" ADD CONSTRAINT "sprint_cycle_items_cycle_id_sprint_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."sprint_cycles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sprint_cycle_items" ADD CONSTRAINT "sprint_cycle_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sprint_cycle_items" ADD CONSTRAINT "sprint_cycle_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sprint_cycles" ADD CONSTRAINT "sprint_cycles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sprint_cycles" ADD CONSTRAINT "sprint_cycles_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sprint_cycles" ADD CONSTRAINT "sprint_cycles_sprint_id_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sprints" ADD CONSTRAINT "sprints_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "squads" ADD CONSTRAINT "squads_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "storage_cleanup_jobs" ADD CONSTRAINT "storage_cleanup_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tags" ADD CONSTRAINT "tags_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_avatars" ADD CONSTRAINT "user_avatars_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_tenant_id_id_unique" ON "api_keys" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assistant_approvals_tenant_status_expiry_idx" ON "assistant_approvals" USING btree ("tenant_id","status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "assistant_approvals_run_operation_hash_unique" ON "assistant_approvals" USING btree ("tenant_id","run_id","operation_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assistant_conversations_tenant_user_updated_idx" ON "assistant_conversations" USING btree ("tenant_id","user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "assistant_events_tenant_run_sequence_unique" ON "assistant_events" USING btree ("tenant_id","run_id","sequence");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assistant_events_tenant_run_created_idx" ON "assistant_events" USING btree ("tenant_id","run_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assistant_messages_tenant_conversation_created_idx" ON "assistant_messages" USING btree ("tenant_id","conversation_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assistant_runs_tenant_conversation_status_idx" ON "assistant_runs" USING btree ("tenant_id","conversation_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "assistant_runs_tenant_user_idempotency_unique" ON "assistant_runs" USING btree ("tenant_id","user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assistant_tool_calls_tenant_run_created_idx" ON "assistant_tool_calls" USING btree ("tenant_id","run_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assistant_tool_calls_tenant_operation_hash_idx" ON "assistant_tool_calls" USING btree ("tenant_id","operation_hash");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "checklists_tenant_id_id_unique" ON "checklists" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "columns_tenant_id_id_unique" ON "columns" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idempotency_records_tenant_owner_tool_key_unique" ON "idempotency_records" USING btree ("tenant_id","owner_id","tool","idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "item_events_tenant_project_date_idx" ON "item_events" USING btree ("tenant_id","project_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "item_events_item_date_idx" ON "item_events" USING btree ("tenant_id","project_id","item_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "item_events_item_occurrence_idx" ON "item_events" USING btree ("tenant_id","project_id","item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "item_events_type_date_idx" ON "item_events" USING btree ("tenant_id","project_id","event_type","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "item_events_correlation_unique" ON "item_events" USING btree ("tenant_id","project_id","correlation_id","event_type","item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "item_logs_tenant_item_type_date_idx" ON "item_logs" USING btree ("tenant_id","item_id","type","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "item_logs_tenant_created_idx" ON "item_logs" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "item_sprints_item_sprint_unique" ON "item_sprints" USING btree ("item_id","sprint_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "items_tenant_id_id_unique" ON "items" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "login_attempts_created_idx" ON "login_attempts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "login_attempts_ip_created_idx" ON "login_attempts" USING btree ("ip","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "login_attempts_email_created_idx" ON "login_attempts" USING btree ("email_canonical","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "memberships_tenant_project_user_unique" ON "memberships" USING btree ("tenant_id","project_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "modules_tenant_id_id_unique" ON "modules" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coverage_tenant_project_idx" ON "project_analytics_coverage" USING btree ("tenant_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_cost_centers_tenant_id_id_unique" ON "project_cost_centers" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_metrics_daily_tenant_project_date_unique" ON "project_metrics_daily" USING btree ("tenant_id","project_id","metric_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_metrics_daily_date_scan_idx" ON "project_metrics_daily" USING btree ("tenant_id","project_id","metric_date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_versions_tenant_id_id_unique" ON "project_versions" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "projects_tenant_id_id_unique" ON "projects" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sprint_cycle_items_unique" ON "sprint_cycle_items" USING btree ("cycle_id","item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sprint_cycles_active_idx" ON "sprint_cycles" USING btree ("tenant_id","project_id","sprint_id","ended_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sprints_tenant_id_id_unique" ON "sprints" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "squads_tenant_id_id_unique" ON "squads" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "storage_cleanup_jobs_tenant_id_id_unique" ON "storage_cleanup_jobs" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "storage_cleanup_pending_path_unique" ON "storage_cleanup_jobs" USING btree ("tenant_id","storage_path") WHERE "storage_cleanup_jobs"."status" = 'PENDING';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "storage_cleanup_queue_scan_idx" ON "storage_cleanup_jobs" USING btree ("status","available_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tags_tenant_id_id_unique" ON "tags" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_tenant_id_id_unique" ON "users" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique" ON "users" USING btree (lower("email"));