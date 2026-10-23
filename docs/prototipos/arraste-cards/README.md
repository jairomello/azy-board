# Protótipo de movimentação de cards

Abra `index.html` no navegador. O protótipo é isolado, sem dependências nem chamadas à API. Use a alça de quatro setas na lateral esquerda dos cards.

- O card de origem sai do fluxo e vira uma camada que acompanha o ponteiro. Uma sombra do mesmo tamanho ocupa a posição de destino.
- Ao cruzar o meio de outro card, a sombra muda de posição e os outros cards deslizam para a ordem que já terão depois da soltura.
- Ao soltar sobre uma posição válida, apenas o card arrastado anima até a sombra. Os outros cards permanecem onde já estavam.
- O botão **Bloquear Revisão** simula um destino impedido. Ao soltar ali, ou fora das colunas, o card retorna à posição inicial.
- Há temas claro e escuro e um botão para reiniciar os dados. O rodapé mostra a ordem final de cada coluna.

## Correspondência com a aplicação

A estrutura `.board-column > .board-column-dropzone > .board-column-add + .board-column-cards > .kanban-card > .kanban-card-grip + .kanban-card-content` segue `BoardColumns.tsx` e `KanbanCard.tsx`. Colunas de 292 px, alça de 30 px, faixa lateral de status, topo/código, breadcrumb, título, tags/tipo, progresso e rodapé seguem o contrato visual atual. O HTML usa conteúdo ilustrativo e JavaScript puro apenas para demonstrar a interação; não altera o board real nem simula persistência de API.

O mecanismo proposto para a aplicação é manter um destino provisório explícito durante o arraste, ordenar visualmente os cards nessa prévia e só encerrar o overlay após o card ter alcançado o retângulo da sombra. Rejeições devem ser explícitas e restaurar a origem.
