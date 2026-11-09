# Design

## Contexto

A planilha do IAjuda Campo tem mais informação por atividade do que o card atual consegue guardar: quatro datas (previstas, realizadas e baseline) e um responsável que frequentemente é um time ou uma pessoa sem conta. A carga precisa ser repetível para acompanhar as edições da planilha até o cutover. O adaptador do Jira, depois, precisa guardar a chave do item criado. Nenhuma dessas necessidades exige mudar a hierarquia ou o Leaf Rule; são metadados do item e uma operação de upsert.

## Modelo de dados

Campos novos em `items`, todos opcionais:

| Campo | Tipo | Regra |
|---|---|---|
| `external_source` | texto (100) | `planilha`, `jira`, `teams`; obrigatório junto de `external_ref` |
| `external_ref` | texto (200) | chave estável no projeto; único por `(tenant, project, source, ref)` |
| `assignee_label` | texto (200) | responsável sem conta; não substitui `assignee_id` |
| `actual_start_date` | data | início realizado |
| `actual_due_date` | data | fim realizado; `>= actual_start_date` quando ambos existirem |
| `baseline_start_date` | data | início original |
| `baseline_due_date` | data | fim original; `>= baseline_start_date` quando ambos existirem |

O par `external_source`/`external_ref` é tudo-ou-nada. O índice único é **parcial** (`WHERE external_ref IS NOT NULL`), então itens sem chave externa continuam livres. O índice de busca usa as mesmas colunas.

As datas continuam independentes: `start_date`/`due_date` são o plano atual; as novas são realizado e baseline. Não há cálculo automático de atraso nesta change.

## Criação e status

Hoje `createItemApplication` grava sempre `NOT_STARTED` (`application/items.ts:124`). A regra nova:

1. Se o corpo informar `status`, ele é usado.
2. Se não informar e houver `columnId`, herda o `baseStatus` da coluna.
3. Se não houver nenhum dos dois, `NOT_STARTED`.

`blockedReason` passa a ser aceito também na criação, para a carga de itens bloqueados. A validação de coerência entre status e coluna fica documentada, mas não bloqueia o upsert: a planilha pode ter um cartão em “Fazendo” com status `BLOCKED`.

## Upsert por chave externa

Rota proposta: `PUT /api/projects/:projectId/items/by-external-ref`.

Corpo mínimo:

```json
{
  "externalSource": "planilha",
  "externalRef": "3f2c...",
  "title": "Atividade",
  "type": "TASK",
  "parentId": "...",
  "columnId": "...",
  "status": "IN_PROGRESS",
  "startDate": "2026-01-10",
  "dueDate": "2026-01-20",
  "actualStartDate": "2026-01-12",
  "assigneeLabel": "Infra Vivo"
}
```

Comportamento:

- Procura por `(tenant, project, source, ref)`.
- Se não existe: exige `title`, aplica as regras de criação (hierarquia, pai, coluna) e devolve `201 { created: true, item }`.
- Se existe: atualiza apenas os campos presentes no corpo, revalida hierarquia quando `parentId`/`type` mudam e devolve `200 { created: false, item }`.
- A chave nunca muda no update; se `externalRef` vier diferente do item encontrado, é conflito.
- Corrida entre dois upserts iguais: o índice único garante um vencedor; o perdedor relê e atualiza. O importador é sequencial, então a corrida é um caso de robustez, não o caminho comum.
- Autorização: `MEMBER` no projeto, tenant do contexto, mesmas regras de API Key. A chave externa é a identidade idempotente; não é necessário um `Idempotency-Key` adicional.

A rota evita que o importador faça `GET` + `POST/PATCH` em duas chamadas e concentra a semântica em um caso de uso testável. O upsert não altera `sequenceCode` automaticamente.

## Contratos

- REST: os campos entram em `createItemSchema`, `updateItemSchema`, `itemFiltersSchema` e na projeção de `GET /items`.
- MCP: `create_task`, `update_item`/`update_items` e `list_tasks` (projeção). O catálogo é a fonte única (`packages/tool-registry/src/fields.ts`).
- Web: a modal mostra as datas realizadas/baseline e o responsável externo; o card mostra o label quando não há usuário.
- Shadow Markdown: o nome do responsável cai para `assigneeLabel` quando não há usuário, mantendo o formato estável.

## Migrations

- SQLite `0055_item_tracker_metadata.sql`: `ALTER TABLE items ADD COLUMN` para os sete campos, `CREATE UNIQUE INDEX ... WHERE external_ref IS NOT NULL` e índice de busca. A validação de par e de datas fica na API (SQLite não permite adicionar CHECK por `ALTER TABLE`).
- PostgreSQL `0028_item_tracker_metadata.sql`: mesmos campos, índice único parcial e CHECKs de par e de datas.
- Atualizar os schemas Drizzle dos dois dialetos para refletir as colunas e o índice.
- Nenhum backfill: os campos nascem nulos. Itens existentes não são tocados.

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Upsert criar duplicata em corrida | Índice único parcial + releitura e update no conflito |
| Status divergir da coluna | Regra explícita de herança quando o status não é informado; teste de criação com coluna DONE |
| Datas incoerentes | Validação na API para os dois pares; teste de erro 422 |
| Mudança de contrato quebrar agentes | Campos opcionais; projeção e schema estendidos; testes de catálogo e contrato |
| Migração PostgreSQL divergir da SQLite | Teste de paridade e de migrations nos dois dialetos |

## Plano de teste

- **Unidade/aplicação:** criação com status explícito, com herança da coluna e sem nenhum; validação de datas; par source/ref.
- **Integração REST:** upsert cria, repete sem duplicar, atualiza campos, devolve 409 em chave diferente, isola tenants e respeita permissões.
- **Persistência:** `findByExternalRef` nos dois adapters; índice único; paridade SQLite/PostgreSQL.
- **MCP:** catálogo, campos aceitos, projeção de `list_tasks`, permissão negada.
- **Web:** modal salva os campos; card mostra o label; i18n.
- **Smoke:** criar um card com os campos novos no fluxo autenticado.

## Rollback

A change é aditiva. Reverter o código deixa as colunas e o índice no banco (migração só avança); um rollback completo exige restaurar o backup pré-migração. Nenhum dado existente é reescrito.
