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

| Ferramenta | Descrição |
|---|---|
| `list_tasks` | Lista tasks de um projeto (apenas folhas por padrão) |
| `get_current_sprint` | Retorna sprint ativa do projeto |
| `claim_task` | Reivindica uma task para o agente |
| `move_task` | Move card para outra coluna pelo nome |
| `batch_move` | Move até 500 itens folha para uma coluna em uma única operação atômica (itemIds + nome exato ou ID da coluna) |
| `complete_task` | Marca task como concluída |
| `create_task` | Cria nova task (pode criar subtasks via `parentId` e versão opcional via `versionId`); em projetos hierárquicos TASK/BUG exigem `parentId` válido — não há cards órfãos |
| `list_checklists` | Lista checklists de um card com itens e progresso |
| `create_checklist` | Cria um checklist nomeado em um card |
| `add_checklist_item` | Adiciona um item a um checklist existente |
| `add_checklist_item_to_task` | Localiza ou cria um checklist pelo nome e adiciona um passo, retornando os IDs gerados |
| `check_item` | Marca item de checklist como concluído ou não |
| `list_projects` / `get_project` | Descobre projetos e configurações |
| `get_board` / `get_tree` | Consulta board estruturado e árvore |
| `get_shadow_markdown` | Consulta o board em Markdown |
| `create_project` / `create_project_structure` / `update_project` | Cria e configura projeto e estrutura |
| `update_item` | Atualiza campos de item |
| `update_items` | Atualiza atomicamente itens selecionados por tipo, status, sprint, versão, módulo, responsável, pai, coluna, tag, título ou IDs |
| `release_task` | Libera atribuição de task |
| `archive_item` / `unarchive_item` / `delete_item` | Gerencia ciclo de vida de item |
| `create_module` | Cria módulo hierárquico |
| `list_sprints` / `create_sprint` | Consulta e cria sprints |
| `activate_sprint` / `close_sprint` | Controla ciclo de sprint |
| `list_tags` / `create_tag` / `set_item_tags` | Gerencia tags e associações |
| `list_versions` / `create_version` | Gerencia versões |
| `list_members` / `list_squads` | Consulta equipe e squads |
| `add_member` / `update_member` / `remove_member` | Administra membros e papéis |
| `list_cost_centers` / `create_cost_center` | Administra centros de custo |
| `reorder_items` | Persiste a ordem dos cards |
| `list_attachments` | Consulta metadados de anexos |
| `list_item_logs` / `create_item_log` | Consulta e registra atividade |
| `list_modules` | Lista módulos do projeto |
| `list_columns` / `create_column` / `reorder_columns` | Gerencia colunas do board |
| `create_squad` | Cria squad no projeto |
| `update_item_log` | Atualiza atividade manual |
| `update_checklist` / `delete_checklist` | Gerencia checklists |
| `update_checklist_item` / `delete_checklist_item` | Gerencia passos de checklist |
| `batch` | Executa criações em lote com atomicidade opcional |
| `delete_project` | Exclui projeto ou gera preview |

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
