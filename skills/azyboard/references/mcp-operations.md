# Operação MCP

## Descoberta

- `list_projects`: localiza projetos acessíveis. Quando `AZYBOARD_PROJECT_ID` está configurada, o projeto já é conhecido e esta etapa pode ser pulada.
- `get_project`: confirma `boardMode`, papel e configuração.
- `get_board` ou `get_tree`: lê o estado atual antes de planejar.
- `get_current_sprint`, `list_columns`, `list_tags`, `list_versions` e `list_members`: consulte apenas o contexto necessário.
- `get_shadow_markdown`: use quando uma visão textual for melhor para análise.

`projectId` aceita o ID (UUID) ou o nome exato do projeto; nomes são resolvidos contra os projetos acessíveis à API Key e erros de nome são corrigíveis.

## Catálogo

O catálogo completo de ferramentas está no `apps/mcp/src/index.ts`. A lista operacional também está em `apps/mcp/README.md`; nomes e schemas devem ser conferidos no servidor, não memorizados pela skill.

As ferramentas cobrem projetos, itens, módulos, colunas, sprints, tags, versões, membros, squads, centros de custo, anexos, checklists, logs, ordenação e operações em lote. Operações administrativas exigem o papel correspondente.

## Hierarquia e modos

```text
HIERARCHICAL: módulo -> EPIC -> STORY -> TASK/BUG -> TASK/BUG
SIMPLE:       STORY fixa -> TASK/BUG
```

Use `list_modules` antes de criar EPIC quando necessário. `create_task` resolve o primeiro módulo se `moduleId` não for informado. Em `SIMPLE`, TASKs e BUGs podem ser criados diretamente e o backend associa a STORY fixa.

`onlyLeaves` é `true` por padrão. Use `false` para navegar pais. Apenas folhas são cards Kanban móveis; pais agregam progresso e pontos.

## Mutação

- Crie ou atualize somente depois de ler o estado atual.
- Use `claim_task` para reservar TASK/BUG e `release_task` para liberar.
- Use `move_task` com nome exato da coluna; prefira `complete_task` ao concluir.
- Prefira operações em lote a chamadas repetidas: `batch_move` move até 500 cards para uma coluna atomicamente; `update_items` atualiza campos por filtro; `batch` cria hierarquias.
- Use `batch` para criações relacionadas que se beneficiem de atomicidade, com `idempotencyKey` quando houver reenvio possível.
- Use checklist para passos verificáveis da mesma unidade; use subtask quando houver responsável, estimativa ou ciclo Kanban independente.

### Checklists

Use `add_checklist_item_to_task` quando o objetivo for apenas adicionar um passo por nome de checklist. Essa operação resolve ou cria o checklist e retorna o checklist e o passo criados.

Nas operações de baixo nível, preserve a relação dos IDs:

```text
itemId          = card/item pai
checklistId     = checklist pertencente ao itemId
checklistItemId = passo pertencente ao checklistId
```

Fluxo recomendado: `list_tasks` para obter o `itemId`, `list_checklists` para obter o `checklistId`, e então `add_checklist_item` ou `check_item` usando os IDs retornados. Não invente UUIDs para esses campos.

## Erros

Respostas de erro têm `code`, `message` e `retryable`. Conflitos de claim, validação, autorização e IDs fora do escopo não devem ser repetidos automaticamente. Falhas transitórias só podem ser repetidas quando `retryable` for verdadeiro e a operação for segura/idempotente.
