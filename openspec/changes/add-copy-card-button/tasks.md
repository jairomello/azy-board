## 1. Componente e lógica de cópia

- [x] 1.1 Criar helper puro e testável do texto de referência (`formatCardReference`): `sequenceCode` quando existir, senão apenas o título; sempre com `[id=<uuid>]` e aspas simples externas
- [x] 1.2 Adicionar o botão "Copiar referência" na barra de ações do `KanbanCard` (ícone `Copy`, mesmo estilo dos botões de arquivar/excluir), sempre renderizado independente de `onArchive`/`onDelete`
- [x] 1.3 Implementar a cópia com `navigator.clipboard.writeText` e fallback (`textarea` + `document.execCommand('copy')`), tratando falha sem quebrar o board
- [x] 1.4 Adicionar feedback de sucesso (ícone `Check` por ~1,5s), `stopPropagation` no clique e acessibilidade (`type="button"`, `title`/`aria-label` traduzidos)

## 2. i18n

- [x] 2.1 Adicionar as chaves `copyItemReference` e `copiedReference` em `apps/web/src/i18n/locales/{pt-BR,en,es}/board.json`
- [x] 2.2 Rodar `bun run check:i18n` garantindo paridade nos três idiomas

## 3. Testes

- [x] 3.1 Teste de unidade do `formatCardReference` cobrindo card com e sem `sequenceCode` e o formato exato com aspas
- [x] 3.2 Teste de contrato do `KanbanCard` garantindo botão presente, ícone `Copy`, uso de `navigator.clipboard.writeText` e `stopPropagation`
- [x] 3.3 Conferir que os testes de contrato existentes de ações do card (arquivar/excluir) continuam válidos

## 4. Verificação

- [x] 4.1 Rodar `bun run check` (typecheck + lint + testes + build)
- [ ] 4.2 Validar manualmente no deploy `/azyboard/`: copiar a referência e colar no prompt de um CLI, conferindo o texto com o UUID completo
- [x] 4.3 Rodar `openspec validate add-copy-card-button`
