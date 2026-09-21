# Integridade do Banco

Este documento descreve as constraints de integridade introduzidas pela mudança
`enforce-schema-integrity` e como operar migrations, saneamento e rollback.

## Princípios

- **Escopo por tenant no banco.** Toda relação entre entidades usa chave
  estrangeira composta que inclui `tenant_id`, e cada tabela pai possui
  `UNIQUE (tenant_id, id)`. Vínculos cross-tenant são rejeitados mesmo se a
  aplicação falhar.
- **Defesa em profundidade.** A validação em runtime continua existindo; as
  constraints são a última linha de defesa.
- **Exclusão centralizada.** As FKs de hierarquia usam `NO ACTION`. Desde o
  Item 12, a exclusão de item/projeto passa por um único executor
  (`services/deletion.ts`); os arquivos físicos de anexos saem por outbox
  pós-commit (ver "Política de exclusão e cascatas").
- **Erros de constraint são de domínio.** Violações viram `409 CONFLICT`
  (unicidade/FK) ou `422 INVALID_REQUEST` (CHECK/NOT NULL) no contrato único de
  erro, nunca `500`.

## Constraints aplicadas

| Tabela | Invariante |
| --- | --- |
| `users` | `UNIQUE (lower(email))` global (email canônico), `CHECK` de grupo global |
| `memberships` | `UNIQUE (tenant_id, project_id, user_id)`, FKs compostas |
| `item_tags` | `PRIMARY KEY (item_id, tag_id)`, `tenant_id`, FKs compostas |
| `item_sprints` | `tenant_id`, FKs compostas, unicidade item/sprint |
| `items` | auto-FK composta `(tenant_id, parent_id)`, FKs para projeto/módulo/coluna/usuário/versão/centro de custo/API key, `CHECK` de `points`/`position`/datas/tipo |
| `projects` | FKs `manager_user_id` e `simple_story_id`, `CHECK` de pontos/horas/datas |
| `modules`, `columns`, `sprints`, `project_versions`, `checklists` | FKs compostas e `CHECK` de posição/datas |
| `item_logs`, `attachments`, `checklist_items`, `project_cost_centers`, `tags`, `squads` | FKs compostas e `CHECK` de não-negatividade |
| Todas as tabelas pai | `UNIQUE (tenant_id, id)` |

## Email canônico e identidade global

Desde a change `global-email-identity` (item 29), o e-mail é a **identidade
global** do usuário: `UNIQUE (lower(email))` no banco, sem escopo de tenant.
A canonicalização (`trim().toLowerCase()`) é feita em
`apps/api/src/utils/email.ts`, usada em login, criação de usuário e setup, e
também no saneamento da migration `0028_global_email_identity`. A migration
canonicaliza os e-mails existentes, preserva o registro mais antigo de cada
endereço repetido e renomeia os demais com sufixo determinístico `+dup<rowid>`
antes de criar o índice global. O login resolve o usuário por esse e-mail
canônico e deriva o `tenant_id` da identidade encontrada.

## Defaults temporais

Defaults de `created_at`/`updated_at` são avaliados pelo banco a cada `INSERT`,
nunca no carregamento do módulo. O schema usa
`sql\`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))\``, que produz UTC no formato
`YYYY-MM-DDTHH:MM:SS.SSSZ`, compatível com os dados e consultas existentes.

- Colunas `NOT NULL` **sem** default (ex.: `project_versions.created_at`,
  `assistant_messages.created_at`) continuam exigindo valor explícito da
  aplicação.
- `updated_at` segue a mesma estratégia de default, mas a aplicação continua
  responsável por atualizá-lo nas mutações.
- A migration `0022_*` reconstrói as tabelas que haviam materializado literais
  congelados (herdados da `0021`) e **não** reescreve timestamps históricos.
- Cobertura: `apps/api/src/db/timestamp.test.ts`.

## Auditoria de integridade

O módulo `apps/api/src/db/integrity.ts` verifica órfãos, cross-tenant,
duplicatas e valores inválidos. O script:

```bash
DATABASE_URL=/caminho/azyboard.db bun run apps/api/src/scripts/auditIntegrity.ts
```

retorna JSON `{ ok, violations: [{ check, table, count }] }` e sai com código 1
se houver violação.

## Rollup diário do Dashboard (Item 13)

`project_metrics_daily` (migration 0024) acumula, por tenant/projeto/dia UTC,
`total`/`done`/`points`/`done_points` de itens folha elegíveis. O update é
incremental feito por `appendAnalyticsEvent` na MESMA transação do evento
(deltas por evento, sem worker). invariantes e operação:

- **Paridade**: o caminho deve reproduzir o replay por evento — o gate
  `rollupMatchesReplay(tenant, project, from, to)` compara o acervo com o
  replay da baseline e dos eventos; qualquer divergência indica snapshot
  inconsistente gravado por um fluxo e requer `recomputeProjectRollup`
  (replay completo, idempotente) por projeto.
- **Backfill**: no startup (`ensureDashboardRollupsBackfill`) para projetos com
  cobertura e sem linhas; idempotente por projeto. [DB-SWAP] PostgreSQL múltiplas
  instâncias: mover para job com `FOR UPDATE SKIP LOCKED` ou materialized view.
- **Rodapé índices**: `item_events_item_occurrence_idx` (transições por item usadas
  por `/snapshot` e `/aging`) e `item_logs_tenant_created_idx` (períodos de `/hours`).
- **Linhas paginadas**: `/hours` aceita `limit` (padrão 500, máximo 2000) com
  ordenação determinística (`created_at`, `id`); totais sempre por SQL.

## Escopo de relações em operações em lote (Item 15)

O batch de atualização por filtros (`/batch/items/update`) carrega
`item_sprints` e `item_tags` POR JOIN com os itens do projeto do tenant
autenticado (`app/api/src/routes/batch.ts`). Regras:

- A consulta sempre exige `item_sprints.tenant_id`/`item_tags.tenant_id` =
  tenant da requisição e itens com `tenant_id` + `project_id` iguais ao contexto.
- Nunca carregar as tabelas globais para filtrar em memória; os pares são
  deduplicados por `(item, relação)` e usados como conjuntos (`Set`).
- O vínculo excluído no executor também é recortado por `tenant_id`.
- Plano validado com `EXPLAIN QUERY PLAN`: os FKs compostos
  `(tenant_id, item_id)` sustentam o join; nenhuma migration extra foi
  necessária. [DB-SWAP] Em PostgreSQL, validar `EXPLAIN (ANALYZE, BUFFERS)`.

## Política de exclusão e cascatas (Item 12)

A exclusão é executada por **um único executor** compartilhado
(`apps/api/src/services/deletion.ts`), chamado pelas rotas de item e de projeto.
Nenhuma outra rota deve listar tabelas manualmente; ao criar uma tabela filha,
a política dela entra aqui:

| Relação | Estratégia | Onde é tratada |
| --- | --- | --- |
| `items.parent_id` (auto-FK) | Delete explícito — subárvore inteira em lotes | `deleteItemsCascade` |
| `checklist_items → checklists` | Delete explícito (filho antes do pai) | executor + rota de checklists |
| `checklists → items` | Delete explícito (período do executor, caminhos de anexos antes) | `deleteItemsCascade` |
| `item_tags`, `item_sprints` → items/tags/sprints | Delete explícito com filtro de `tenant_id` | `deleteItemsCascade` / `deleteProjectCascade` |
| `attachments → items` | Metadados na transação; **arquivo físico via outbox pós-commit** | `deleteItemsCascade` + `storageCleanup.ts` |
| `item_logs → items` | Delete explícito com filtro de tenant | `deleteItemsCascade` |
| `projects.simple_story_id → items` | `SET NULL` pela aplicação antes de excluir itens | `deleteProjectCascade` |
| `project_analytics_coverage`, `item_events`, `sprint_cycles`/items → projects | `ON DELETE CASCADE` no banco (herdado da migration 0011) | banco |
| `assistant_messages/runs/events/tool_calls/approvals → conversations` | `ON DELETE CASCADE` no banco | banco |
| `storage_cleanup_jobs` | **Sem FK de recurso** — o job sobrevive ao metadado | outbox |

Regras vigentes:

1. FKs puramente dependentes **podem** usar `CASCADE` quando a migration
   preservar constraints e escopo; associação e referências especiais continuam
   explícitas no executor. Nenhuma nova cascata foi introduzida no SQLite atual —
   o executor centralizado é a única fonte de exclusão.
2. Todo delete/leitura do executor aplica `tenantId`; associações N:N também
   filtram o `tenant_id` da própria tabela.
3. Carregamento da subárvore é feito nível a nível (BFS em lotes de consulta),
   sem `IN` gigantes, dentro de uma transação por operação.

### Outbox de limpeza do storage

Ciclo de vida: a exclusão de metadados enfileira em
`storage_cleanup_jobs` (id, tenant, `storage_path`, recurso) **na mesma
transação**; após o commit o endpoint dispara o processador, que também roda
no startup e a cada 60 s (`startStorageCleanupWorker`).

- **Idempotência**: índice parcial `UNIQUE (tenant_id, storage_path) WHERE
  status = 'PENDING'` + `ON CONFLICT DO NOTHING`; arquivo inexistente é sucesso.
- **Retry**: falha do adapter agenda reprocessamento com backoff exponencial
  (30 s → 30 min) e `available_at`; após 8 tentativas o job vai para `FAILED`
  com `last_error` e só reintegração manual resolve.
- **Auditoria**: `stale_storage_cleanup_jobs` (pendentes > 24 h) e
  `failed_storage_cleanup_jobs` entram no relatório de integridade.
- [DB-SWAP] Multi-instância em PostgreSQL: mover o consumo para worker com
  `FOR UPDATE SKIP LOCKED`; em SQLite, o ciclo no processo API é suficiente.


## Migration e saneamento

A migration `0021_*` faz, nesta ordem:

1. `PRAGMA foreign_keys=OFF` (o runner já desativa antes da transação).
2. Saneamento determinístico: e-mail canônico, deduplicação de memberships e
   associações, backfill de `tenant_id` em `item_tags`/`item_sprints`, anulação
   de referências órfãs/cross-tenant e coerção de números/datas.
3. Índices únicos dos pais criados nas tabelas antigas (o SQLite valida o alvo
   da FK no prepare).
4. Reconstrução das tabelas com FKs compostas e `CHECK`s.
5. Guard final: `pragma_foreign_key_check`; se houver violação, a transação
   inteira é revertida.

O runner (`migrate.ts`) revalida `PRAGMA foreign_key_check` após a migration e
aborta se houver resíduo.

## Relatório de saneamento e deploy

O saneamento só altera dados quando encontra violações. O procedimento de deploy
arquiva a saída da migration ao lado do backup:

```bash
# no host do LabApps
DATA=/opt/labapps/deploy/azyboard/data
STAMP=$(date +%Y%m%d-%H%M%S)
cp "$DATA/azyboard.db" "$DATA/backups/azyboard-$STAMP.db"
docker exec azyboard-api sh -c 'MIGRATIONS_DIR=/app/migrations bun run /app/migrate.ts' \
  2>&1 | tee "$DATA/backups/sanitization-$STAMP.log"
```

> A migration não imprime linha a linha para preservar o histórico mais recente
> de `item_events`. O relatório vivo é obtido com `auditIntegrity.ts` após o
> deploy (ver abaixo).

## Rollback

1. Reverter a aplicação para o commit anterior.
2. Restaurar o backup do banco copiado antes do deploy.
3. Confirmar com `PRAGMA foreign_key_check` e `auditIntegrity.ts`.

Como a migration altera o schema, o rollback exige o backup do banco; não há
migration reversa.

## Equivalência em PostgreSQL (sem RLS)

A modelagem é portável. Ao migrar (Item 9):

- Manter as chaves compostas e FKs iguais; em PostgreSQL a unicidade de
  `(tenant_id, id)` pode ser `UNIQUE` explícito.
- Substituir o índice de e-mail por `UNIQUE (tenant_id, lower(email))`
  (índice por expressão é suportado).
- `CHECK`s permanecem iguais; `integer` booleano vira `boolean`.
- Defaults temporais viram `TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP` (substituindo
  o `strftime` do SQLite).
- O procedimento de rebuild de tabela não é necessário: usar `ALTER TABLE ...
  ADD CONSTRAINT` para FKs e checks, e `ALTER COLUMN ... SET DEFAULT` para os
  defaults temporais.
- Habilitar RLS por `tenant_id` como defesa adicional é o passo seguinte
  (escopo do Item 9).
