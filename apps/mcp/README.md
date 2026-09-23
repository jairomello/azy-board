# Azy Board — Servidor MCP

Servidor MCP (Model Context Protocol) para integração do Azy Board com agentes
de IA como Claude Code, Codex e OpenCode. O objetivo é permitir que um code
agent descubra, configure e execute um projeto sem operar a interface manualmente.

## Configuração no Claude Code

Adicione ao seu `.claude/settings.json`:

```json
{
  "mcpServers": {
    "azy-board": {
      "command": "bun",
      "args": ["run", "/caminho/para/easyboard/apps/mcp/src/index.ts"],
      "env": {
        "EASYBOARD_API_KEY": "azb_sua_chave_aqui",
        "EASYBOARD_URL": "http://localhost:3000"
      }
    }
  }
}
```

## Ferramentas disponíveis

<!-- BEGIN GENERATED: mcp-catalog -->
<!-- GERADO AUTOMATICAMENTE por scripts/generate-docs.ts — não editar; rode `bun run generate:docs`. -->

Catálogo com 59 ferramentas, derivado de `apps/mcp/src/registry.ts`.

| Ferramenta | Descrição |
|---|---|
| `activate_sprint` | Ativa a sprint informada. |
| `add_checklist_item` | Add a step to an existing checklist. itemId is the parent board card ID; checklistId must belong to that card; text is the step text. Do not use checklistId or checklistItemId as itemId. Accepts optional dueDate, assigneeId and description when the project enables advancedChecklists. |
| `add_checklist_item_to_task` | Add a checklist step to a board card. itemId is the parent card ID, checklistName is the checklist name, and the tool creates the checklist when it does not exist. Use this when you do not already have a checklistId; it returns both checklist and checklist item IDs. Accepts optional dueDate, assigneeId and description when the project enables advancedChecklists. |
| `add_member` | Adiciona um membro ao projeto por e-mail com role ADMIN, MEMBER ou VIEWER. |
| `archive_item` | Arquiva um item. confirm é true por padrão; suporta dryRun. |
| `batch` | Create an ordered hierarchy of up to 50 EPIC, STORY, TASK, or BUG items in one atomic approval. Use refs and parentRefs instead of database IDs. Use moduleName for EPIC items; a module referenced by name that does not exist yet is created automatically. |
| `batch_move` | Move up to 500 leaf items to a column in one atomic operation. Requires itemIds and the exact destination column name (or column ID). Prefer this over multiple move_task calls when moving several cards at once. For filter-based bulk moves without explicit IDs, use update_items. |
| `check_item` | Set a checklist step state. itemId is the parent board card ID, checklistId belongs to that card, and checklistItemId belongs to that checklist. |
| `claim_task` | Atribui o item ao usuário atual (claim). Use apenas quando o item estiver disponível. |
| `close_sprint` | Encerra a sprint informada. |
| `complete_task` | Conclui um item. Para card folha, move-o para a coluna com baseStatus DONE. |
| `create_checklist` | Create a named checklist on a board card. itemId is the parent card ID, not a checklist or checklist item ID. |
| `create_column` | Cria uma coluna no board com name e baseStatus (NOT_STARTED, IN_PROGRESS ou DONE). |
| `create_cost_center` | Cria um centro de custo no projeto com code e description opcional. |
| `create_item_log` | Registra um log de trabalho no item. activity é texto curto (até 20000 caracteres); durationMin é opcional, em minutos. |
| `create_module` | Cria um módulo no projeto. |
| `create_project` | Create an Azy Board project. Only name is required. Use null for an unspecified description or boardMode and never ask for optional values. The authenticated user is assigned as manager by the server. |
| `create_project_structure` | Create a project and an ordered hierarchy of up to 50 items in one approved operation. Use refs and parentRefs instead of database IDs; moduleName resolves an existing module by name. |
| `create_sprint` | Cria uma sprint com name, startDate e endDate (YYYY-MM-DD). |
| `create_squad` | Cria um squad no projeto. |
| `create_tag` | Cria uma tag no projeto; color é opcional. |
| `create_task` | Create a single EPIC, STORY, TASK or BUG. SIMPLE projects: TASK/BUG auto-assign to the project story; parentId and moduleId are optional. HIERARCHICAL projects: parentId required for TASK/BUG (a STORY, TASK or BUG) and for STORY (an EPIC); EPIC is a root with moduleId. |
| `create_version` | Cria uma versão do projeto. |
| `delete_checklist` | Exclui uma checklist do item. |
| `delete_checklist_item` | Exclui um passo da checklist. |
| `delete_item` | Exclui um item. Ação destrutiva; suporta dryRun. |
| `delete_project` | Exclui um projeto e os registros dependentes. Ação destrutiva; suporta dryRun. |
| `get_board` | Retorna colunas, módulos e itens do board do projeto. As descrições longas vêm resumidas por padrão; use includeDescriptions=true para o texto completo. Em projetos grandes, prefira list_tasks com filtros. |
| `get_current_sprint` | Retorna a sprint ativa (CURRENT) do projeto, se houver. |
| `get_project` | Consulta os dados de um projeto por projectId (ID ou nome exato). |
| `get_shadow_markdown` | Retorna o board do projeto em Markdown (board.md) para leitura rápida. |
| `get_tree` | Retorna a hierarquia de itens (EPIC > STORY > TASK/BUG), filtrável por moduleId, assigneeId e sprintId. Descrições resumidas por padrão; use includeDescriptions=true para o texto completo. |
| `list_attachments` | Lista os anexos de um item. Requer projectId e itemId. |
| `list_checklists` | List checklists and their steps for a board card. itemId is the parent card ID. Returns dueDate, assigneeId and description on steps when the project enables advancedChecklists. |
| `list_columns` | Lista as colunas do board com seus status base. |
| `list_cost_centers` | Lista os centros de custo do projeto. |
| `list_item_logs` | Lista os logs de trabalho de um item do board. |
| `list_members` | Lista os membros do projeto. |
| `list_modules` | Lista os módulos do projeto. |
| `list_projects` | Lista os projetos acessíveis à credencial. Use para descobrir projectId; aceita paginação com limit/cursor. |
| `list_sprints` | Lista as sprints do projeto. |
| `list_squads` | Lista os squads do projeto. |
| `list_tags` | Lista as tags do projeto. |
| `list_tasks` | Lista itens do projeto; onlyLeaves é true por padrão. Filtros opcionais: type, status, assigneeId, sprintId, tagIds, parentId, columnId, moduleId, com paginação por limit/cursor. Omitir um filtro equivale a não filtrar. |
| `list_versions` | Lista as versões do projeto. |
| `move_task` | Move um item para a coluna informada pelo nome exato (ou ID). |
| `release_task` | Libera a atribuição do item, removendo o responsável atual. |
| `remove_member` | Remove um membro do projeto. |
| `reorder_columns` | Reordena as colunas do board conforme a lista order. |
| `reorder_items` | Reordena os itens de uma coluna conforme a lista order de IDs. |
| `set_item_tags` | Substitui as tags do item pela lista tagIds informada. |
| `unarchive_item` | Desarquiva um item. |
| `update_checklist` | Atualiza nome/posição de uma checklist do item. |
| `update_checklist_item` | Atualiza o texto/estado de um passo da checklist. changes aceita text, checked, dueDate, assigneeId e description (os três últimos exigem checklists detalhados no projeto). |
| `update_item` | Atualiza um item específico. changes aceita a lista {field, operation, value}; as operações CLEAR, TODAY, OFFSET_DAYS e COPY_CREATED_DATE dependem do campo. |
| `update_item_log` | Atualiza o texto e/ou a duração de um log de trabalho. |
| `update_items` | Atomically update one or many active items selected by filters. For bulk moves, set filters.column to the source column, preserve every other requested criterion, and add a column SET change with the destination. Generic tasks or cards in a bulk move covers leaf TASK and BUG items unless the user explicitly restricts the type. Also supports fixed values, clearing fields, relative dates, today, and copying each item creation date. Use itemIds for one item and matchAll only for every item without narrower filters. |
| `update_member` | Atualiza o papel (e o squad opcional) de um membro do projeto. |
| `update_project` | Atualiza campos do projeto (nome, descrição, boardMode, planejamento). Omita os campos que não devem mudar. |

<!-- END GENERATED: mcp-catalog -->
`update_item` e `update_items` recebem alterações no formato `{ field, operation, value }`. As operações são `SET`, `CLEAR`, `TODAY`, `OFFSET_DAYS` e `COPY_CREATED_DATE`; filtros aceitam IDs ou nomes exatos, e `sprint: "CURRENT"` seleciona a sprint ativa.

### IDs de checklist

Os IDs formam uma hierarquia obrigatória:

```text
itemId = card/item pai que possui o checklist
checklistId = checklist pertencente ao itemId
checklistItemId = passo pertencente ao checklistId
```

Nunca use `checklistId` ou `checklistItemId` como `itemId`. Para adicionar um passo sem conhecer os IDs internos do checklist, prefira:

```json
{
  "projectId": "project-123",
  "itemId": "card-456",
  "checklistName": "Validação",
  "text": "Executar testes"
}
```

O fluxo manual é `list_tasks` → `list_checklists` → `add_checklist_item` → `check_item`, sempre reutilizando os IDs retornados pela etapa anterior.

### Campos avançados de checklist

Quando o projeto tem `advancedChecklists = true` (configuração do projeto em Settings), os passos aceitam três campos opcionais:

- `dueDate` — data prevista no formato `YYYY-MM-DD`;
- `assigneeId` — ID de um membro do projeto;
- `description` — descrição em HTML (até 20000 caracteres).

Eles podem ser informados em `add_checklist_item` e `add_checklist_item_to_task`, e alterados em `update_checklist_item` via `changes` (ex.: `{ "dueDate": "2026-10-01", "assigneeId": "user-1" }`). `list_checklists` retorna os campos quando habilitados. Em projetos sem a opção, enviar esses campos retorna erro de validação e os passos permanecem simples (apenas `text` e `checked`).

## Projeto padrão da codebase (`AZYBOARD_PROJECT_ID`)

Quando um agente trabalha sempre no mesmo projeto (caso típico: um repositório
de código vinculado a um projeto do Azy Board), defina `AZYBOARD_PROJECT_ID` no
ambiente do servidor MCP. Efeitos:

- `projectId` passa a ser **opcional** em todas as ferramentas; quando omitido,
  o servidor injeta o projeto padrão.
- O `projectId` omitido pode ser informado explicitamente para operar outro
  projeto — o padrão não restringe o escopo da API Key.

```json
{
  "mcpServers": {
    "azy-board": {
      "command": "bun",
      "args": ["run", "/caminho/para/azyboard/apps/mcp/src/index.ts"],
      "env": {
        "EASYBOARD_API_KEY": "azb_sua_chave_aqui",
        "EASYBOARD_URL": "http://localhost:3000",
        "AZYBOARD_PROJECT_ID": "01abcdef-0000-0000-0000-000000000000"
      }
    }
  }
}
```

O valor obtido na URL `/projects/<id>/...` é o formato recomendado. Como a API
Key continua sendo um segredo, prefira o cofre de segredos do cliente; o ID do
projeto não é sensível e pode ficar versionado no `opencode.json`/settings do
repositório.

## Resolução de projeto por nome

Todas as ferramentas que recebem `projectId` aceitam **o ID (UUID) ou o nome
exato do projeto**. Nomes são resolvidos contra os projetos acessíveis à API
Key; nomes ambíguos ou inexistentes retornam erro corrigível
(`AMBIGUOUS_PROJECT_NAME` / `PROJECT_NOT_FOUND`) sem executar a operação.

## Operações em lote

Para reduzir chamadas repetidas, prefira operações em lote:

| Cenário | Ferramenta |
|---|---|
| Criar até 50 itens com hierarquia | `batch` ou `create_project_structure` |
| Mover vários cards para outra coluna | `batch_move` |
| Atualizar campos de vários itens por filtro | `update_items` |

## Exemplo de fluxo de um agente

```
1. get_current_sprint({ projectId: "xxx" })
   → Sprint 12 ativa

2. list_tasks({ projectId: "xxx", onlyLeaves: true })
   → [ { id: "abc", title: "Configurar banco", status: "NOT_STARTED" }, ... ]

3. claim_task({ projectId: "xxx", taskId: "abc" })
   → Task atribuída ao agente; aparece no board com badge de IA

4. create_task({ projectId: "xxx", title: "Criar índices", parentId: "abc", points: 3, versionId: "release-1" })
   → Subtask criada; task pai sai do Kanban (Leaf Rule)

5. complete_task({ projectId: "xxx", taskId: "abc-sub" })
   → Card movido para coluna DONE; progresso do pai atualizado
```

## Variáveis de ambiente

| Variável | Descrição | Padrão |
|---|---|---|
| `EASYBOARD_API_KEY` | API Key gerada no painel do Azy Board | obrigatório |
| `EASYBOARD_URL` | URL base da API | `http://localhost:3000` |
| `AZYBOARD_PROJECT_ID` | Projeto padrão da codebase; torna `projectId` opcional nas ferramentas | opcional |

## Autorização

A chave autentica o agente como seu Owner humano. O servidor resolve, em cada
chamada, o tenant, grupo global (`TEAM_MEMBER`, `MANAGER`, `ADMIN` ou `ROOT`),
membership/papel local e estado da chave. O payload nunca pode alterar esses
valores. `projectScope` e `permissionScope` são restrições adicionais, nunca
privilégios novos; chave expirada, revogada, inválida ou fora do escopo é
rejeitada sem revelar o recurso.

Leituras exigem papel local `VIEWER`, conteúdo exige `MEMBER`, configuração do
projeto exige `ADMIN`, e `create_project` exige grupo global `MANAGER`. O módulo
Administração REST continua reservado a `ADMIN`/`ROOT`. Não há upload via IA.

## Fluxo AI First

Um agente pode seguir este fluxo sem usar a interface:

```text
list_projects → create_project → get_project/get_board
→ create_module/create_task ou criação direta em projeto SIMPLE
→ claim_task → update_item → move_task/complete_task
→ create_checklist/add_checklist_item/check_item
→ create_item_log → get_board ou get_shadow_markdown
```

Em projetos `SIMPLE`, o backend encaminha TASKs e BUGs para a STORY fixa. O
agente não precisa criar módulo, EPIC ou parentId manualmente.

As ferramentas retornam texto legível e conteúdo estruturado. Erros devem ser
tratados como resultado operacional e não como sinal para repetir cegamente a
operação, especialmente em conflitos de claim, conversões e exclusões.
