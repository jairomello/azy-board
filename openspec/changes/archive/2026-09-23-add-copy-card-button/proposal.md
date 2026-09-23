## Why

Quem trabalha com agentes de IA no CLI frequentemente precisa referenciar uma tarefa específica no meio do prompt. Hoje isso exige abrir o card, localizar o código e o identificador e montar o texto à mão. Um botão de copiar no próprio card entrega uma referência pronta e padronizada (código + título + id resolvível), reduzindo atrito e erro de transcrição.

## What Changes

- Adicionar um botão de ação **Copiar referência** no card do Kanban, somente ícone (Lucide `Copy`), posicionado ao lado dos botões de arquivar e excluir, visível no hover do card.
- Ao clicar, copiar para a área de transferência um texto plano no formato `'<código> - <título> [id=<uuid>]'` (com aspas simples externas), onde:
  - `<código>` é o `sequenceCode` do item (ex.: `T5`); quando ausente, nenhum código é incluído — o texto fica apenas `<título> [id=<uuid>]`.
  - `<título>` é o título completo do card (sem truncar).
  - `<uuid>` é o **identificador completo** do item, utilizável diretamente pelas ferramentas MCP/CLI.
- Dar feedback visual de sucesso (ícone vira `Check` por ~1,5s) e tratar falha de clipboard sem quebrar o board.
- Copiar é uma ação somente-leitura: o botão SHALL aparecer para todos os papéis com acesso ao board (inclusive VIEWER), ao contrário de arquivar/excluir.
- Traduzir os textos (tooltip e rótulo de acessibilidade) em pt-BR, en e es no namespace `board`.
- Sem alteração de backend, API, banco ou contratos MCP.

## Capabilities

### New Capabilities
- `card-copy-reference`: define o botão de copiar referência do card — formato exato do texto, fallback de código, feedback de sucesso/falha, acessibilidade e disponibilidade por papel.

### Modified Capabilities
<!-- Nenhuma: a interação é nova e não altera requisitos existentes de card-management, card-archive ou card-delete-action. -->

## Impact

- **Web:** `apps/web/src/components/KanbanCard.tsx` (novo botão na barra de ações em hover) e `apps/web/src/i18n/locales/{pt-BR,en,es}/board.json` (novas chaves).
- **Reuso:** padrão de clipboard já existente em `apps/web/src/components/ApiKeysSection.tsx` (`navigator.clipboard.writeText` + estado de copiado).
- **API/DB/MCP:** nenhum impacto.
- **Rastreabilidade:** card do board a definir (proposta ainda não vinculada a um card).
- **Fora de escopo:** copiar descrição/checklists, botão de copiar dentro do modal, formato configurável, deep link/URL do card, copiar em Markdown.
