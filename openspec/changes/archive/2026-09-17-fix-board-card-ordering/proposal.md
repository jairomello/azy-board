## Why

O card B1 pode ser arrastado visualmente para outra posição dentro da mesma coluna, mas retorna à ordem anterior depois do drop. Isso impede o uso básico do Kanban para priorizar cards e precisa ser corrigido preservando a regra de cards folha e o endpoint de ordenação existente.

## What Changes

- Corrigir a resolução do alvo e da posição no drag-and-drop vertical dentro da mesma coluna.
- Garantir que a ordem otimista exibida no board seja persistida pelo endpoint de reorder.
- Garantir rollback visual quando a persistência falhar.
- Cobrir a regressão com testes de interação e contrato do payload enviado.
- Preservar movimentação entre colunas, ordenação de colunas, filtros, sincronização e demais regras do board.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `board-management`: corrigir a persistência da posição vertical dos cards após drag-and-drop na mesma coluna.

## Impact

- **Frontend:** `apps/web/src/features/board/hooks/useBoardInteraction.ts`, `apps/web/src/features/board/model/interaction.ts` e componentes/handlers de drag-and-drop.
- **Testes:** testes de interação do Board e contratos do endpoint `PATCH /projects/:id/items/reorder`.
- **Backend/API:** nenhum endpoint novo; o contrato existente de reorder será mantido.
- **Rastreabilidade:** Board ref: `00b4a9b6-15c2-4467-84b5-32e9c29c818a`.
