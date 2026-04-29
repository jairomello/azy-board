# Azy Board — Servidor MCP

Servidor MCP (Model Context Protocol) para integração do Azy Board com agentes de IA como Claude Code.

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
| `complete_task` | Marca task como concluída |
| `create_task` | Cria nova task (pode criar subtasks via `parentId`) |
| `list_checklists` | Lista checklists de um card com itens e progresso |
| `create_checklist` | Cria um checklist nomeado em um card |
| `add_checklist_item` | Adiciona um item a um checklist existente |
| `check_item` | Marca item de checklist como concluído ou não |

## Exemplo de fluxo de um agente

```
1. get_current_sprint({ projectId: "xxx" })
   → Sprint 12 ativa

2. list_tasks({ projectId: "xxx", onlyLeaves: true })
   → [ { id: "abc", title: "Configurar banco", status: "NOT_STARTED" }, ... ]

3. claim_task({ projectId: "xxx", taskId: "abc" })
   → Task atribuída ao agente; aparece no board com badge de IA

4. create_task({ projectId: "xxx", title: "Criar índices", parentId: "abc", points: 3 })
   → Subtask criada; task pai sai do Kanban (Leaf Rule)

5. complete_task({ projectId: "xxx", taskId: "abc-sub" })
   → Card movido para coluna DONE; progresso do pai atualizado
```

## Variáveis de ambiente

| Variável | Descrição | Padrão |
|---|---|---|
| `EASYBOARD_API_KEY` | API Key gerada no painel do Azy Board | obrigatório |
| `EASYBOARD_URL` | URL base da API | `http://localhost:3000` |
