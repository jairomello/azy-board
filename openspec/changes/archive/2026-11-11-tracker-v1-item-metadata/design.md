# Design

## Contexto

A planilha do IAjuda Campo tem três conjuntos de datas por atividade (original, previsto e realizado) e um responsável que frequentemente é um time ou uma pessoa sem conta. O card já tem as datas previstas (`start_date`/`due_date`); faltam as realizadas e o responsável externo. A chave externa da linha é útil para rastreabilidade, mas nesta versão é **apenas informativa**: não precisa de unicidade, upsert ou filtro.

Nenhuma dessas necessidades exige mudar a hierarquia, o Leaf Rule, o comportamento de criação ou o status.

## Modelo de dados

Campos novos em `items`, todos opcionais:

| Campo | Tipo | Regra |
|---|---|---|
| `external_source` | texto (100) | `planilha`, `jira`, `teams`; informativo |
| `external_ref` | texto (200) | referência da linha; informativo, sem unicidade |
| `assignee_label` | texto (200) | responsável sem conta; não substitui `assignee_id` |
| `actual_start_date` | data | início realizado |
| `actual_due_date` | data | fim realizado; `>= actual_start_date` quando ambos existirem |

As datas continuam independentes: `start_date`/`due_date` são o plano atual (colunas E/F); as novas são o realizado (colunas G/H). **Não há baseline nesta change**; as colunas C/D da planilha são ignoradas.

## Criação e status

A criação **não muda**: `createItemApplication` continua gravando `NOT_STARTED` e o schema de criação não aceita `blockedReason`. A carga cria todos os itens primeiro e, em uma segunda passada, aplica `status`, `blockedReason` e os demais metadados via `PATCH`. Isso preserva o comportamento core da ferramenta e evita uma regra nova de status na criação.

## Chave externa informativa

`externalSource`/`externalRef` são gravados no item e devolvidos na API, no MCP e na UI, mas:

- não têm índice único;
- não têm validação de par obrigatório;
- não têm upsert;
- não têm filtro na listagem.

A carga usa a chave apenas como mapa local para reconhecer itens em uma reexecução; a identidade no banco continua sendo o `id`.

## Contratos

- REST: os campos entram em `createItemSchema`, `updateItemSchema` e na projeção de `GET /items`. `blockedReason` continua apenas no update.
- MCP: `create_task`, `update_item`/`update_items` e `list_tasks` (projeção). O catálogo é a fonte única (`packages/tool-registry/src/fields.ts`).
- Web: a modal mostra as datas realizadas e o responsável externo; o card mostra o label quando não há usuário.
- Shadow Markdown: o nome do responsável cai para `assigneeLabel` quando não há usuário, mantendo o formato estável.

## Migrations

- SQLite `0055_item_tracker_metadata.sql`: `ALTER TABLE items ADD COLUMN` para os cinco campos. Sem índice.
- PostgreSQL `0028_item_tracker_metadata.sql`: mesmos campos e CHECK do par de datas realizadas. Sem índice único.
- Atualizar os schemas Drizzle dos dois dialetos para refletir as colunas.
- Nenhum backfill: os campos nascem nulos. Itens existentes não são tocados.

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Chave externa repetida | É informativa por decisão; a carga usa o mapa local e o `id` como identidade |
| Status divergir da coluna | A criação mantém `NOT_STARTED`; a segunda passada aplica o status desejado |
| Datas incoerentes | Validação na API para o par realizado; teste de erro 422 |
| Mudança de contrato quebrar agentes | Campos opcionais; projeção e schema estendidos; testes de catálogo e contrato |
| Migração PostgreSQL divergir da SQLite | Teste de paridade e de migrations nos dois dialetos |

## Plano de teste

- **Unidade/aplicação:** criação força `NOT_STARTED` mesmo com `status`/coluna DONE; `blockedReason` é rejeitado na criação; validação do par de datas realizadas.
- **Integração REST:** criação e atualização dos campos; chave externa repetida é aceita; endpoint de upsert não existe; filtro por chave não existe.
- **Persistência:** paridade SQLite/PostgreSQL dos campos novos.
- **MCP:** catálogo, campos aceitos, projeção de `list_tasks`, permissão negada.
- **Web:** modal salva as datas realizadas e o responsável externo; card mostra o label; i18n.
- **Smoke:** criar um card e aplicar os metadados em uma segunda chamada.

## Rollback

A change é aditiva. Reverter o código deixa as colunas no banco (migração só avança); um rollback completo exige restaurar o backup pré-migração. Nenhum dado existente é reescrito.
