## Context

O Azy Board é usado por agentes de IA que precisam rastrear passos de execução internos a um card sem criar ruído no board. A hierarquia de `items` (EPIC → STORY → TASK → subtask) é o mecanismo formal de decompor trabalho; checklists são o mecanismo informal e leve para listar etapas que não merecem visibilidade como cards autônomos. O schema atual não tem estrutura para isso — adicionamos duas tabelas novas sem alterar `items`.

## Goals / Non-Goals

**Goals:**
- Qualquer card (qualquer `type`) pode ter N checklists nomeados.
- Cada checklist tem M itens ordenados com estado `checked/unchecked`.
- Barra de progresso agregada (todos os checklists do card) visível no KanbanCard.
- CRUD completo via REST e via MCP tools (para agentes de IA).
- Realtime: mudanças de checklist propagadas via WebSocket.

**Non-Goals:**
- Itens de checklist com responsável ou data de vencimento (v1).
- Drag-and-drop para reordenar itens (v1 — usa botões ↑↓).
- Checklists visíveis na Tree View (somente dentro do modal do card).
- Conversão de item de checklist em TASK autônoma (v1).

## Decisions

### 1. Duas tabelas separadas (`checklists` + `checklist_items`)

Alternativa considerada: coluna `checklists JSON` dentro de `items`.

Escolha: tabelas normalizadas. Motivo: permite updates granulares por item (marcar um único item como checked não reescreve o JSON inteiro), queries eficientes de progresso e FK para integridade referencial. O custo é um JOIN extra ao carregar o card — aceitável dado o volume esperado.

### 2. Progresso agregado calculado no frontend

O endpoint `GET /items/:itemId` retornará os checklists com seus itens. O frontend calcula `checkedCount / totalCount` localmente. Alternativa (coluna `progress` desnormalizada em `items`) foi descartada por criar inconsistência eventual entre a coluna e o estado real dos itens.

### 3. Posição por inteiro simples (`position INTEGER`)

Sem LSeq/fractional indexing em v1. Ao reordenar, atualiza todos os positions dos itens do checklist em uma transaction (igual ao reorder de cards nas colunas). Suficiente para o volume esperado (checklists têm tipicamente < 20 itens).

### 4. Checklists carregados dentro do modal, não no load inicial do board

O `GET /projects/:id/items` (load do board) NÃO inclui checklists — mantém o payload leve. Checklists são carregados sob demanda no `GET /projects/:id/items/:itemId` (quando o modal abre). O KanbanCard exibe apenas o resumo de progresso (`checked/total`) que vem de uma coluna calculada no endpoint de items do board.

### 5. Campo `checklistProgress` no payload do board

Para exibir a barra de progresso no card sem carregar checklists completos, o `GET /items` incluirá um campo `checklistProgress: { checked: number; total: number } | null` calculado via subquery agregada.

## Risks / Trade-offs

- **Subquery de progresso em cada card** → potencial N+1 se feita por item. Mitigation: usar subquery agregada com `GROUP BY itemId` em uma única query adicional ao carregar o board.
- **Sem drag-and-drop em v1** → experiência de reordenação mais rudimentar. Mitigation: botões ↑↓ são suficientes para o caso de uso principal (IA cria e marca itens, humano raramente reordena).
- **[DB-SWAP]** Subquery com `GROUP BY` funciona em SQLite e PostgreSQL sem mudanças de sintaxe.

## Migration Plan

1. Adicionar tabelas `checklists` e `checklist_items` ao schema Drizzle e rodar `drizzle-kit push`.
2. Sem migração de dados existentes (feature aditiva pura).
3. Rollback: dropar as duas tabelas e remover as rotas/componentes — zero impacto em dados existentes.
