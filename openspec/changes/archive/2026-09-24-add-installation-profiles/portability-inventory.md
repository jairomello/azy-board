# Inventário de portabilidade SQLite → PostgreSQL

Board ref: `732e4f5b-872e-4a29-9958-d66ed0b43e0d`.

Este inventário descreve a implementação antes das mudanças. Não define nem
inclui transporte de dados entre perfis; esse mecanismo está explicitamente
fora de escopo.

## Bootstrap e schema

| Área | Implementação atual | Trabalho por dialect |
|---|---|---|
| Conexão | `db/index.ts` importa `bun:sqlite` e cria a conexão no carregamento do módulo; `DATABASE_URL` é caminho local; PRAGMA WAL/FK | Selecionar adapter antes de criar/importar DB; PostgreSQL usa pool; SIMPLE mantém inicialização sem serviços |
| Migration | `db/migrate.ts` usa migrator `bun-sqlite`; PRAGMA FK OFF/CHECK/ON | Runner PostgreSQL e journal separados; checagem de integridade sem PRAGMA |
| Drizzle Kit | `drizzle.config.ts` tem `dialect: sqlite` | Config/geração independente por dialect, sem sobrescrever journal SQLite |
| Schema | `schema.ts` define 36 tabelas com `sqlite-core` | Schema PostgreSQL correspondente e paridade de nomes, tipos, índices, FK, CHECK e relações |
| Setup | `scripts/setup.ts` importa o DB global e cria tenant/admin | Resolver perfil e marcador antes de abrir conexão; setup ADVANCED sempre provisiona destino novo |

## Famílias de tabelas persistentes

| Família | Tabelas | Atenções de paridade |
|---|---|---|
| Identidade/tenant | tenants, users, login_attempts, api_keys, user_avatars | unicidade `lower(email)`, FKs tenant-composite, booleanos INTEGER→BOOLEAN, BLOB→bytea |
| Azy Agent | assistant_credentials/settings/conversations/messages/runs/events/tool_calls/approvals, idempotency_records | sequências, concorrência, unicidade/idempotência, JSON em TEXT e ciphertext sem alterar chaves |
| Projeto/equipe | projects, squads, project_cost_centers, memberships, modules, columns | unicidades, FKs tenant/project, board modes, owner e história fixa |
| Board/planning | sprints, items, project_versions, tags, item_tags, item_sprints | Leaf Rule, ancestry JSON em TEXT, FKs compostas, datas, posições e checks |
| Histórico/analytics | item_logs, item_events, project_analytics_coverage, sprint_cycles/items, project_metrics_daily | sequência de eventos, rollup/replay, timestamps e transações |
| Arquivos/checklists | attachments, checklists/items, storage_cleanup_jobs | BLOBs/metadados, outbox pós-commit, ordem e limpeza idempotente |

## SQLite-específico em runtime

- `schema.ts`: `sqliteTable/sqlite-core`, `defaultNowIso()` com `strftime`,
  índice de expressão `lower(email)`, `blob`, integer boolean e SQL em CHECK.
- `db/index.ts`: `bun:sqlite`, `PRAGMA journal_mode = WAL` e
  `PRAGMA foreign_keys`.
- `db/migrate.ts`: migrator bun-sqlite e PRAGMA para foreign keys.
- `db/integrity.ts` e `scripts/auditIntegrity.ts`: tipo `bun:sqlite.Database`,
  SQL de auditoria e data com `strftime`.
- `routes/dashboard.ts`, `routes/items.ts` e `routes/assistant.ts`: SQL Drizzle
  para EXISTS/IN, expressões temporais, transações, upsert e `returning`; validar
  cada fluxo contra PostgreSQL real, não apenas compilar.
- Migrations atuais: 30 entradas (`0000`–`0029`), journal marcado
  `dialect: sqlite`; manter append-only e nunca reaproveitar esse journal no PG.

## Estado em memória / coordenação

- `routes/assistant.ts`: `requestTimes: Map` limita requisições por processo.
- `services/websocket.ts`: `rooms: Map` guarda conexões e faz broadcast local.
- `startStorageCleanupWorker()` consome outbox no processo da API.
- Outros `Map` em `assistantHarness`, `routes/items`, `routes/batch` e
  `dashboardMetrics` são caches/acumuladores locais de uma run, requisição ou
  cálculo, não estado distribuído.
- Redis pode coordenar rate limit e pub/sub no perfil avançado; não fornece por
  si só fila durável do agente (Item 4) nem replay/reconciliação do board (Item 20).

## Equivalência de tipos e invariantes

| Contrato | SIMPLE (SQLite) | ADVANCED (PostgreSQL) |
|---|---|---|
| IDs | TEXT gerado pela aplicação | preservar inicialmente IDs string/text, sem conversão durante runtime |
| Booleanos/números | INTEGER boolean, INTEGER/REAL | BOOLEAN e tipos numéricos com mesma nullabilidade/range |
| Datas | ISO UTC em TEXT; default `strftime` | tipo temporal/codec serializado no mesmo contrato UTC ISO |
| JSON/ancestry | JSON serializado em TEXT | JSON/JSONB ou codec TEXT com mesmo shape |
| E-mail | `UNIQUE lower(email)` e normalização da aplicação | índice único em `lower(email)` e mesmo `trim().toLowerCase()` |
| Arquivos | BLOB para avatar e storage local para anexos | bytea para avatar; adapter de storage não muda nesta change |
| Integridade | FK compostas tenant, CHECKs, índices e transactions | mesmos invariantes com SQL/migrations próprias do PostgreSQL |

## Baseline anterior às mudanças

`bun run check` passou antes de qualquer código desta change: **483 testes, 0
falhas**, com typecheck, lint e build concluídos. Essa é a baseline SIMPLE que
deve permanecer verde durante o trabalho.
