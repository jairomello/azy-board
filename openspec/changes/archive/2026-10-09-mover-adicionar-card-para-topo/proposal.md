# Proposal

## Why

Hoje o controle "Adicionar card" fica no **rodapé** de cada coluna do Kanban. Em colunas longas, o usuário precisa rolar até o fim para criar um card, o que piora a usabilidade justamente quando há muito conteúdo. Mover o controle para o **topo**, logo abaixo do título da coluna e antes dos cards, mantém a criação sempre visível e acessível.

## What Changes

- Mover o controle de criação de card (botão `+ Adicionar card` e o formulário rápido inline) do rodapé da coluna para o topo da coluna, imediatamente abaixo do cabeçalho e antes da lista de cards.
- Ajustar espaçamentos para que o controle fique bem posicionado no topo sem colidir com o primeiro card, na densidade confortável e na compacta.
- Preservar todo o comportamento atual: formulário rápido inline (título, tipo, sprint opcional, versão opcional), permissões (`allowAdd`), criação via `POST /projects/:id/items`, atualização em tempo real e estados de coluna vazia/destino de arraste.
- Sem alterações de dados, API, permissões ou traduções.

## Capabilities

### New Capabilities

<!-- nenhuma capability nova -->

### Modified Capabilities

- `card-creation-ui`: o requisito **"Botão de criação de card por coluna envia para `/items`"** deixa de posicionar o botão no **rodapé** e passa a posicioná-lo no **topo da coluna**, abaixo do cabeçalho e acima dos cards, preservando o formulário rápido inline e o envio para `POST /projects/:id/items`.

## Impact

- Frontend: `apps/web/src/features/board/components/BoardColumns.tsx` (reordenação do bloco de criação) e `apps/web/src/styles/globals.css` (espaçamentos `.board-column-add`/`.board-add-card`/`.board-column-cards`, inclusive `.density-compact`).
- Verificação visual: baseline `e2e/__screenshots__/board-simple.png` passa a divergir (controle no topo) e deve ser regenerada.
- Sem impacto em rotas, API, banco, i18n ou outros componentes.
