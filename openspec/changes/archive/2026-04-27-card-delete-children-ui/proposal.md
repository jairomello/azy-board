## Why

Os cards do Kanban carecem de ação de exclusão direta, de feedback visual sobre por que cards pai ficam bloqueados, de indicadores rápidos de progresso hierárquico e de uma identidade visual consistente nos botões — em conjunto, isso reduz a clareza da interface e aumenta a fricção do usuário ao gerenciar o board.

## What Changes

- **Novo botão "Excluir" nos cards**: ícone de lixeira visível no hover do card; ao confirmar, exclui o item e todos os seus descendentes (checklists, subtasks, etc.) em cascata. Apenas usuários com papel ADMIN ou MEMBER podem excluir.
- **Box informativa na modal de card bloqueado**: quando a modal de uma task/bug com subtasks é aberta, exibe um bloco explicativo descrevendo que o card está bloqueado para arrastar pois seu status é derivado do progresso dos seus filhos — o status real é calculado a partir da conclusão das subtasks.
- **Indicador de filhos no footer do card**: cards com subtasks exibem no rodapé um ícone representativo (GitBranch) acompanhado do número de filhos diretos; sem texto descritivo, apenas ícone + número.
- **Ícones Lucide nos botões de ação**: todos os botões de ação recebem ícone Lucide alinhado ao texto. Lucide React já está instalado (v0.460.0) — nenhuma dependência nova necessária.
- **Botões preenchidos com cores modernas**: todos os botões que hoje têm apenas contorno colorido passam a ter fundo preenchido com a cor correspondente (azul primário, vermelho para destrutivo, cinza para secundário, etc.), usando variáveis do tema Tailwind existentes.

## Capabilities

### New Capabilities

- `card-delete-action`: botão excluir no card (com diálogo de confirmação) e endpoint de exclusão em cascata no backend, restrito a ADMIN/MEMBER.
- `blocked-card-info-box`: caixa explicativa na modal de item que possui filhos, descrevendo a Leaf Rule e o motivo pelo qual o card não é arrastável.
- `card-footer-children-indicator`: indicador visual no rodapé do card mostrando a contagem de filhos diretos com ícone Lucide.
- `button-visual-redesign`: padronização de estilo dos botões para preenchidos com cores modernas e adição de ícones Lucide representativos em todos os botões de ação da aplicação.

### Modified Capabilities

## Impact

- **Frontend**: `KanbanCard.tsx` (botão excluir, indicador de filhos), `ItemModal.tsx` (box informativa), componentes de botão em toda a aplicação (`BoardPage.tsx`, `ItemModal.tsx`, `AddCardForm.tsx`, etc.).
- **Backend**: novo endpoint `DELETE /items/:id` com lógica de exclusão recursiva respeitando `tenantId` e RBAC.
- **Tipos compartilhados** (`packages/types`): `CardData` precisa expor `childrenCount` (filhos diretos).
- **API contratual**: rota de exclusão nova; queries de listagem de items precisam retornar `childrenCount`.
- **Dependências**: nenhuma nova — Lucide React já instalado.
