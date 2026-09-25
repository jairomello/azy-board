-- FKs compostas (tenant_id, id) — isolamento cross-tenant no banco.
-- Equivalente ao SQLite em schema.ts; o pg-core não tipifica FKs compostas bem.

-- Unique indexes necessários para FKs compostas em tabelas que não os têm.
CREATE UNIQUE INDEX IF NOT EXISTS "assistant_conversations_tenant_id_id_unique" ON "assistant_conversations" ("tenant_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "assistant_runs_tenant_id_id_unique" ON "assistant_runs" ("tenant_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "assistant_tool_calls_tenant_id_id_unique" ON "assistant_tool_calls" ("tenant_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "assistant_credentials_tenant_id_id_unique" ON "assistant_credentials" ("tenant_id", "id");

-- user_avatars(tenant_id, user_id) → users(tenant_id, id)
ALTER TABLE "user_avatars" ADD CONSTRAINT "user_avatars_tenant_user_fk"
  FOREIGN KEY ("tenant_id", "user_id") REFERENCES "users"("tenant_id", "id") ON DELETE CASCADE;

-- api_keys(tenant_id, owner_id) → users(tenant_id, id)
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenant_owner_fk"
  FOREIGN KEY ("tenant_id", "owner_id") REFERENCES "users"("tenant_id", "id");

-- projects(tenant_id, manager_user_id) → users(tenant_id, id)
ALTER TABLE "projects" ADD CONSTRAINT "projects_tenant_manager_fk"
  FOREIGN KEY ("tenant_id", "manager_user_id") REFERENCES "users"("tenant_id", "id");

-- squads(tenant_id, project_id) → projects(tenant_id, id)
ALTER TABLE "squads" ADD CONSTRAINT "squads_tenant_project_fk"
  FOREIGN KEY ("tenant_id", "project_id") REFERENCES "projects"("tenant_id", "id");

-- project_cost_centers(tenant_id, project_id) → projects(tenant_id, id)
ALTER TABLE "project_cost_centers" ADD CONSTRAINT "project_cost_centers_tenant_project_fk"
  FOREIGN KEY ("tenant_id", "project_id") REFERENCES "projects"("tenant_id", "id");

-- memberships(tenant_id, user_id) → users(tenant_id, id)
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_user_fk"
  FOREIGN KEY ("tenant_id", "user_id") REFERENCES "users"("tenant_id", "id");

-- memberships(tenant_id, project_id) → projects(tenant_id, id)
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_project_fk"
  FOREIGN KEY ("tenant_id", "project_id") REFERENCES "projects"("tenant_id", "id");

-- memberships(tenant_id, squad_id) → squads(tenant_id, id)
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_squad_fk"
  FOREIGN KEY ("tenant_id", "squad_id") REFERENCES "squads"("tenant_id", "id");

-- modules(tenant_id, project_id) → projects(tenant_id, id)
ALTER TABLE "modules" ADD CONSTRAINT "modules_tenant_project_fk"
  FOREIGN KEY ("tenant_id", "project_id") REFERENCES "projects"("tenant_id", "id");

-- columns(tenant_id, project_id) → projects(tenant_id, id)
ALTER TABLE "columns" ADD CONSTRAINT "columns_tenant_project_fk"
  FOREIGN KEY ("tenant_id", "project_id") REFERENCES "projects"("tenant_id", "id");

-- sprints(tenant_id, project_id) → projects(tenant_id, id)
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_tenant_project_fk"
  FOREIGN KEY ("tenant_id", "project_id") REFERENCES "projects"("tenant_id", "id");

-- project_versions(tenant_id, project_id) → projects(tenant_id, id)
ALTER TABLE "project_versions" ADD CONSTRAINT "project_versions_tenant_project_fk"
  FOREIGN KEY ("tenant_id", "project_id") REFERENCES "projects"("tenant_id", "id");

-- items(tenant_id, project_id) → projects(tenant_id, id)
ALTER TABLE "items" ADD CONSTRAINT "items_tenant_project_fk"
  FOREIGN KEY ("tenant_id", "project_id") REFERENCES "projects"("tenant_id", "id");

-- items(tenant_id, module_id) → modules(tenant_id, id)
ALTER TABLE "items" ADD CONSTRAINT "items_tenant_module_fk"
  FOREIGN KEY ("tenant_id", "module_id") REFERENCES "modules"("tenant_id", "id");

-- items(tenant_id, column_id) → columns(tenant_id, id)
ALTER TABLE "items" ADD CONSTRAINT "items_tenant_column_fk"
  FOREIGN KEY ("tenant_id", "column_id") REFERENCES "columns"("tenant_id", "id");

-- items(tenant_id, assignee_id) → users(tenant_id, id)
ALTER TABLE "items" ADD CONSTRAINT "items_tenant_assignee_fk"
  FOREIGN KEY ("tenant_id", "assignee_id") REFERENCES "users"("tenant_id", "id");

-- items(tenant_id, author_id) → users(tenant_id, id)
ALTER TABLE "items" ADD CONSTRAINT "items_tenant_author_fk"
  FOREIGN KEY ("tenant_id", "author_id") REFERENCES "users"("tenant_id", "id");

-- items(tenant_id, assignee_api_key_id) → api_keys(tenant_id, id)
ALTER TABLE "items" ADD CONSTRAINT "items_tenant_assignee_api_key_fk"
  FOREIGN KEY ("tenant_id", "assignee_api_key_id") REFERENCES "api_keys"("tenant_id", "id");

-- items(tenant_id, cost_center_id) → project_cost_centers(tenant_id, id)
ALTER TABLE "items" ADD CONSTRAINT "items_tenant_cost_center_fk"
  FOREIGN KEY ("tenant_id", "cost_center_id") REFERENCES "project_cost_centers"("tenant_id", "id");

-- items(tenant_id, version_id) → project_versions(tenant_id, id)
ALTER TABLE "items" ADD CONSTRAINT "items_tenant_version_fk"
  FOREIGN KEY ("tenant_id", "version_id") REFERENCES "project_versions"("tenant_id", "id");

-- item_logs(tenant_id, item_id) → items(tenant_id, id)
ALTER TABLE "item_logs" ADD CONSTRAINT "item_logs_tenant_item_fk"
  FOREIGN KEY ("tenant_id", "item_id") REFERENCES "items"("tenant_id", "id");

-- item_logs(tenant_id, author_id) → users(tenant_id, id)
ALTER TABLE "item_logs" ADD CONSTRAINT "item_logs_tenant_author_fk"
  FOREIGN KEY ("tenant_id", "author_id") REFERENCES "users"("tenant_id", "id");

-- item_tags(tenant_id, item_id) → items(tenant_id, id)
ALTER TABLE "item_tags" ADD CONSTRAINT "item_tags_tenant_item_fk"
  FOREIGN KEY ("tenant_id", "item_id") REFERENCES "items"("tenant_id", "id");

-- item_tags(tenant_id, tag_id) → tags(tenant_id, id)
ALTER TABLE "item_tags" ADD CONSTRAINT "item_tags_tenant_tag_fk"
  FOREIGN KEY ("tenant_id", "tag_id") REFERENCES "tags"("tenant_id", "id");

-- item_sprints(tenant_id, item_id) → items(tenant_id, id)
ALTER TABLE "item_sprints" ADD CONSTRAINT "item_sprints_tenant_item_fk"
  FOREIGN KEY ("tenant_id", "item_id") REFERENCES "items"("tenant_id", "id");

-- item_sprints(tenant_id, sprint_id) → sprints(tenant_id, id)
ALTER TABLE "item_sprints" ADD CONSTRAINT "item_sprints_tenant_sprint_fk"
  FOREIGN KEY ("tenant_id", "sprint_id") REFERENCES "sprints"("tenant_id", "id");

-- attachments(tenant_id, item_id) → items(tenant_id, id)
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_tenant_item_fk"
  FOREIGN KEY ("tenant_id", "item_id") REFERENCES "items"("tenant_id", "id");

-- checklists(tenant_id, item_id) → items(tenant_id, id)
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_tenant_item_fk"
  FOREIGN KEY ("tenant_id", "item_id") REFERENCES "items"("tenant_id", "id");

-- checklist_items(tenant_id, checklist_id) → checklists(tenant_id, id)
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_tenant_checklist_fk"
  FOREIGN KEY ("tenant_id", "checklist_id") REFERENCES "checklists"("tenant_id", "id");

-- checklist_items(tenant_id, assignee_id) → users(tenant_id, id)
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_tenant_assignee_fk"
  FOREIGN KEY ("tenant_id", "assignee_id") REFERENCES "users"("tenant_id", "id");

-- assistant_conversations(tenant_id, user_id) → users(tenant_id, id)
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_tenant_user_fk"
  FOREIGN KEY ("tenant_id", "user_id") REFERENCES "users"("tenant_id", "id");

-- assistant_conversations(tenant_id, project_id) → projects(tenant_id, id)
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_tenant_project_fk"
  FOREIGN KEY ("tenant_id", "project_id") REFERENCES "projects"("tenant_id", "id");

-- assistant_messages(tenant_id, conversation_id) → assistant_conversations(tenant_id, id)
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_tenant_conversation_fk"
  FOREIGN KEY ("tenant_id", "conversation_id") REFERENCES "assistant_conversations"("tenant_id", "id") ON DELETE CASCADE;

-- assistant_messages(tenant_id, user_id) → users(tenant_id, id)
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_tenant_user_fk"
  FOREIGN KEY ("tenant_id", "user_id") REFERENCES "users"("tenant_id", "id");

-- assistant_runs(tenant_id, conversation_id) → assistant_conversations(tenant_id, id)
ALTER TABLE "assistant_runs" ADD CONSTRAINT "assistant_runs_tenant_conversation_fk"
  FOREIGN KEY ("tenant_id", "conversation_id") REFERENCES "assistant_conversations"("tenant_id", "id") ON DELETE CASCADE;

-- assistant_runs(tenant_id, user_id) → users(tenant_id, id)
ALTER TABLE "assistant_runs" ADD CONSTRAINT "assistant_runs_tenant_user_fk"
  FOREIGN KEY ("tenant_id", "user_id") REFERENCES "users"("tenant_id", "id");

-- assistant_runs(tenant_id, credential_id) → assistant_credentials(tenant_id, id)
ALTER TABLE "assistant_runs" ADD CONSTRAINT "assistant_runs_tenant_credential_fk"
  FOREIGN KEY ("tenant_id", "credential_id") REFERENCES "assistant_credentials"("tenant_id", "id");

-- assistant_events(tenant_id, run_id) → assistant_runs(tenant_id, id)
ALTER TABLE "assistant_events" ADD CONSTRAINT "assistant_events_tenant_run_fk"
  FOREIGN KEY ("tenant_id", "run_id") REFERENCES "assistant_runs"("tenant_id", "id") ON DELETE CASCADE;

-- assistant_tool_calls(tenant_id, run_id) → assistant_runs(tenant_id, id)
ALTER TABLE "assistant_tool_calls" ADD CONSTRAINT "assistant_tool_calls_tenant_run_fk"
  FOREIGN KEY ("tenant_id", "run_id") REFERENCES "assistant_runs"("tenant_id", "id") ON DELETE CASCADE;

-- assistant_approvals(tenant_id, run_id) → assistant_runs(tenant_id, id)
ALTER TABLE "assistant_approvals" ADD CONSTRAINT "assistant_approvals_tenant_run_fk"
  FOREIGN KEY ("tenant_id", "run_id") REFERENCES "assistant_runs"("tenant_id", "id") ON DELETE CASCADE;

-- assistant_approvals(tenant_id, tool_call_id) → assistant_tool_calls(tenant_id, id)
ALTER TABLE "assistant_approvals" ADD CONSTRAINT "assistant_approvals_tenant_tool_call_fk"
  FOREIGN KEY ("tenant_id", "tool_call_id") REFERENCES "assistant_tool_calls"("tenant_id", "id");

-- assistant_approvals(tenant_id, decided_by) → users(tenant_id, id)
ALTER TABLE "assistant_approvals" ADD CONSTRAINT "assistant_approvals_tenant_decided_by_fk"
  FOREIGN KEY ("tenant_id", "decided_by") REFERENCES "users"("tenant_id", "id");

-- assistant_credentials(tenant_id, created_by) → users(tenant_id, id)
ALTER TABLE "assistant_credentials" ADD CONSTRAINT "assistant_credentials_tenant_created_by_fk"
  FOREIGN KEY ("tenant_id", "created_by") REFERENCES "users"("tenant_id", "id");

-- assistant_settings(tenant_id, credential_id) → assistant_credentials(tenant_id, id)
ALTER TABLE "assistant_settings" ADD CONSTRAINT "assistant_settings_tenant_credential_fk"
  FOREIGN KEY ("tenant_id", "credential_id") REFERENCES "assistant_credentials"("tenant_id", "id");

-- idempotency_records(tenant_id, owner_id) → users(tenant_id, id)
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_tenant_owner_fk"
  FOREIGN KEY ("tenant_id", "owner_id") REFERENCES "users"("tenant_id", "id");

-- items(tenant_id, parent_id) → items(tenant_id, id) — auto-referência de hierarquia
ALTER TABLE "items" ADD CONSTRAINT "items_tenant_parent_fk"
  FOREIGN KEY ("tenant_id", "parent_id") REFERENCES "items"("tenant_id", "id");
