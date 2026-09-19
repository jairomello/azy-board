## Context

O card do Kanban (`apps/web/src/components/KanbanCard.tsx`) já tem uma barra de ações no canto superior direito, exibida no hover, com os botões de arquivar e excluir (`KanbanCard.tsx:131-159`). O card exibe `#<id curto>` (8 caracteres) no topo (`KanbanCard.tsx:217`) e o `sequenceCode` ao lado do título quando existe. O padrão de "copiar para área de transferência" já existe em `ApiKeysSection.tsx:36-38` (`navigator.clipboard.writeText` com estado de copiado e ícone `Check`).

O caso de uso é externo ao produto: o usuário cola a referência no prompt de um agente de IA no CLI. Por isso o identificador precisa ser o **UUID completo** do item — as ferramentas MCP/CLI resolvem o item por esse id, não pelo código curto exibido no card. O usuário confirmou essa preferência (UUID completo).

## Goals / Non-Goals

**Goals:**
- Copiar, com um clique, uma referência pronta do card: `'<código> - <título> [id=<uuid>]'`.
- Ser um botão de ação somente-leitura, disponível a todos os papéis com acesso ao board.
- Dar feedback claro de sucesso e falha, sem abrir o modal nem interferir no drag-and-drop.
- Manter o card compacto: apenas ícone, no mesmo padrão visual de arquivar/excluir.

**Non-Goals:**
- Copiar descrição, checklists, datas ou qualquer outro conteúdo além de código, título e id.
- Botão equivalente dentro do modal do item.
- Formato configurável pelo usuário, deep link/URL do card ou cópia em Markdown.
- Alterações de API, banco ou contratos MCP.

## Decisions

### D1. Formato exato do texto copiado

`'<código> - <título> [id=<uuid>]'`, com aspas simples externas, exatamente como no pedido do usuário.

- Código: `card.sequenceCode` quando presente (ex.: `T5`), seguido de ` - `.
- Sem código: quando `sequenceCode` for nulo/em branco, nenhum código é incluído — o texto começa direto no título (sem `#<id curto>`).
- Título: `card.title` completo, sem truncar (o `line-clamp` é só visual).
- UUID: `card.id` completo, para ser resolvível pelos tools.
- Com código: `'T5 - Opcionalmente tarefas do checklist com data [id=9f1c2d3e-...-uuid]'`.
- Sem código: `'Opcionalmente tarefas do checklist com data [id=9f1c2d3e-...-uuid]'`.

As aspas externas seguem o exemplo do pedido ("pode ir inclusive com as aspas") e ajudam a delimitar a referência; ficam encapsuladas no texto copiado.

### D2. Id completo (UUID), não o curto

O `#e067830d` do card é `id.slice(0, 8)` e não é resolvido por `resolveProjectId`/tools (que esperam UUID). Usar o UUID completo é o que torna a referência útil no CLI; o código legível (`T5`) já cobre a parte humana.

### D3. Implementação do clipboard com fallback

Reusar o padrão do `ApiKeysSection`: `await navigator.clipboard.writeText(text)` dentro de `try/catch`. Quando a Clipboard API não estiver disponível (contexto não seguro ou permissão negada), cair para um fallback com `textarea` + `document.execCommand('copy')` e, se ainda falhar, sinalizar erro. A feature não pode quebrar o board nem abrir exceção não tratada.

### D4. Feedback e interação

- Sucesso: trocar o ícone `Copy` por `Check` (verde) por ~1,5s, sem deslocar o layout, e restaurar depois. Opcionalmente usar o `Toast` já existente para confirmação; o estado no ícone é suficiente e menos intrusivo.
- O clique MUST chamar `stopPropagation()` para não abrir/arrastar o card.
- O botão é `<button type="button">` com `title`/`aria-label` traduzido e foco por teclado.

### D5. Disponibilidade por papel

Diferente de arquivar/excluir, copiar não muta nada. O botão SHALL ser renderizado sempre que o card for exibido, inclusive para VIEWER. Não depende de `onArchive`/`onDelete`, que seguem suas regras próprias de permissão.

### D6. i18n

Novas chaves no namespace `board` nos três idiomas: `copyItemReference` (tooltip/aria-label) e `copiedReference` (rótulo/estado de confirmação). Paridade garantida pelo `check:i18n`.

## Risks / Trade-offs

- **Clipboard indisponível** (ex.: acesso via IP/HTTP sem contexto seguro): mitigado com fallback e aviso de erro; o clique nunca lança erro para o usuário.
- **Títulos longos com aspas/vírgulas**: o texto é copiado inteiro; as aspas externas podem ficar ambíguas se o título contiver `'`. Aceitável para o caso de uso (colar em prompt); documentado.
- **UUID verboso** no prompt: trade-off consciente por resolubilidade; o código curto `T5` continua disponível à esquerda para leitura humana.
- **Sem sequenceCode** em itens antigos: o texto traz apenas título + UUID, evitando poluir a referência com um código não resolvível.
