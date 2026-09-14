## Why

O schema atual não representa invariantes essenciais: `items.parentId`, `projects.managerUserId` e `projects.simpleStoryId` não têm FK; várias relações não incluem `tenant_id` no vínculo; `item_tags` não tem chave; `memberships` e `users` não têm unicidade por tenant. Na prática, o filtro `tenantId` em cada query é a única barreira contra referências cross-tenant, duplicatas e órfãos, o que torna erros de rota ou script capazes de corromper a base.

## What Changes

- Adicionar chaves únicas compostas com `tenant_id` nas entidades pai (`users`, `items`, `projects`, `modules`, `columns`, `sprints`, `tags`, `project_versions`, `project_cost_centers`, `squads`), habilitando FKs compostas.
- Adicionar FKs compostas com `tenant_id` para impedir vínculos cross-tenant em `items`, `projects`, `memberships`, `item_tags`, `item_sprints`, `attachments`, `checklists`, `item_logs`, `modules`, `columns`, `sprints`, `projects`, `squads` e `project_cost_centers`.
- Adicionar auto-FK composta em `items(parent_id)` para que hierarquia inválida ou cross-tenant seja rejeitada pelo banco.
- Adicionar `UNIQUE (tenant_id, email normalizado)` em `users`, `UNIQUE (tenant_id, project_id, user_id)` em `memberships` e `PRIMARY KEY (item_id, tag_id)` em `item_tags`.
- Adicionar `CHECK` para datas e números: `sprints.end_date >= start_date`, `items.due_date >= start_date`, `points >= 0`, `position >= 0`, `planned_points >= 0`, `planned_hours >= 0`.
- Criar migration de saneamento que deduplica `memberships`/`item_tags`, normaliza e-mails e trata órfãos antes de aplicar as constraints.
- Mapear violações de constraint para erros de domínio `409`/`422` (contrato único de erro), nunca `500`.
- Adicionar suíte de testes de integridade que verifica órfãos, duplicatas e rejeição cross-tenant no banco.
- **BREAKING** Escritas que hoje aceitam referências cross-tenant, duplicatas ou valores negativos passam a ser rejeitadas pelo banco.

## Capabilities

### New Capabilities

- `schema-integrity`: invariantes de integridade referencial, unicidade e domínio aplicadas no banco.

### Modified Capabilities

- `multi-tenancy`: o isolamento passa a ter defesa no banco via FKs compostas com `tenant_id`, além do filtro de query.
- `unified-item-model`: a hierarquia de `items` passa a ser garantida por auto-FK composta e validações de banco.

## Impact

- Schema Drizzle em `apps/api/src/db/schema.ts` e snapshots em `apps/api/src/db/migrations/meta/`.
- Nova migration SQL com reconstrução de tabelas (SQLite) e saneamento de dados.
- Rotas e serviços de escrita em `apps/api/src/routes` e `apps/api/src/services` (tratamento de conflitos e entrada de dados).
- Middleware de erro para mapear falhas de constraint ao contrato único.
- Testes de migration, integração e integridade; documentação de equivalência em PostgreSQL.
- PostgreSQL/RLS permanece fora do escopo e é tratado no Item 9.
