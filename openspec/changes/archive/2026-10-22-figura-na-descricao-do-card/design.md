# Design

## Context

Ver `proposal.md` — Why. Estado atual verificado no código (23/10/2026):

- **Markdown é o formato canônico** e o TipTap edita HTML: a ponte é `apps/web/src/lib/richText.ts` (`toEditorHtml` = marked; `onUpdate` → `htmlToMarkdown` = turndown). O cabeçalho do arquivo registra a limitação que motiva esta change: imagem "é renderizada nas visões de leitura, mas o editor preserva apenas o texto ao editar conteúdo que a contenha".
- O render de leitura **já** suporta imagem: `safeMarkdownRenderer.image` gera `<img>` com escape e filtro de protocolo (`http`/`https`/`mailto` ou sem esquema).
- O editor é montado por `RichTextEditor` (lazy, ~338 KB) → `RichTextEditorImpl`, com `StarterKit` + `Placeholder` + `Link`. A toolbar tem 11 botões (negrito, itálico, riscado, H1–H3, duas listas, citação, código inline e expandir) e **não** tem ação de link nem de imagem.
- `RichTextEditor` é usado em **6 lugares**: descrição do item (`ItemModal`), épico (`EpicModal`), critérios e notas da história (`StoryModal`), item de checklist (`ChecklistSection`), descrição de anexo (`AttachmentsArea`) e escopo do projeto (`ProjectPlanningFields`).
- **Anexos são escopados ao item**: `POST|GET /projects/:projectId/items/:itemId/attachments` (upload exige `MEMBER`, listagem `VIEWER`), e `GET .../attachments/:attachmentId/download` serve o binário com `Content-Disposition: inline` para raster aprovado, `X-Content-Type-Options: nosniff` e `Cache-Control: private, no-store`. O handler ancora o anexo ao item (`getAttachment(ctx, projectId, itemId, attachmentId)`), então ID forjado no texto não vaza anexo de outro card.
- A allowlist de inline é `isInlineImage` / `INLINE_IMAGE_TYPES` (PNG, JPEG, GIF, WebP, AVIF, BMP) em `apps/web/src/lib/attachmentImage.ts`; **SVG nunca inline**.
- Miniatura e lightbox já existem: `AttachmentThumbnail` (usa `resolveAppUrl(attachment.url)`, com estados de carregamento/falha e vira `<button>` com nome acessível quando recebe `onOpen`) e `yet-another-react-lightbox` montado em `AttachmentsArea` com as imagens do card.
- **A descrição do item só é exibida dentro do editor** — não existe visão de leitura dela em outra tela da UI.
- O rascunho da descrição vive em `localStorage` (`useItemDescriptionDraft`), sempre em Markdown.
- O chunk lazy do editor é `vendor-editor`, com orçamento de **115000 B gzip** e uso atual de ~104 KB.
- No MCP, anexos são **somente leitura** (`list_attachments`, `read_attachment`) e imagem retorna `format=unsupported` — a IA não vê figura.

Decisões confirmadas com o usuário: **miniatura no editor**; **upload no momento da inserção**; **apenas a descrição do card**; **aviso na exclusão + estado no texto**; **clique abre o lightbox com as imagens do card**; **sem legenda editável**.

## Goals / Non-Goals

**Goals:**

- Inserir figura na descrição por duas origens (arquivo do computador e anexo já existente no card) e por colagem da área de transferência, sempre com upload imediato para os anexos do card.
- Apresentar a figura como bloco constrangido (largura da coluna, altura limitada, proporção preservada, borda e canto), com clique abrindo o lightbox das imagens do card.
- **Parar de perder imagem ao editar**: o editor passa a representar a imagem que já existe no Markdown.
- Manter a figura como anexo do card (um único arquivo), sem depósito paralelo e sem mudança de API, banco ou migration.

**Non-Goals:**

- Legenda editável, redimensionar/posicionar/duplicar figura, alinhamento ou texto contornando a imagem (float).
- Arrastar-e-soltar arquivo sobre o editor (o seletor e a colagem cobrem o caso).
- Citar anexo de outro card: a API ancora o anexo ao item, e permitir isso abriria uma consulta entre cards.
- Habilitar o botão nos outros cinco editores (épico, história, checklist, descrição de anexo, escopo) — a prop fica pronta, o uso fica para depois.
- Visão/OCR de imagem pela IA: `read_attachment` continua textual.

## Decisions

**Imagem de verdade em Markdown padrão, apontando para o anexo.** O conteúdo guarda `![nome](url autenticada do anexo)` — sintaxe que já é renderizada na leitura, é portátil (GitHub, editor externo, contexto do agente), e não inventa formato. Alternativas consideradas: **token por id** (`[imagem:<id>]`) — ganha em texto limpo e em detectar anexo removido, mas exige ensinar três camadas (marked, TipTap, turndown) a resolver o token e carregar contexto de resolução em todo lugar que renderiza Markdown, inclusive onde não há contexto de item (mensagens do agente, descrição de link); **`[image1]` posicional** — rejeitada por ser frágil: excluir ou acrescentar um anexo renumera as citações do texto, e o mesmo texto copiado para outro card passa a apontar para outra coisa.

**`@tiptap/extension-image` com imagem em bloco.** A extensão é da mesma família já instalada (MIT, permitida pela regra de licenças) e faz o `getHTML()` devolver `<img>`, que o turndown já converte de volta para `![alt](src)` — é o que corrige o round-trip. `inline: false` (padrão da extensão) mantém a figura em parágrafo próprio: **é o que evita o "texto contornando figura"**, que é a origem da bagunça visual temida. Alternativa considerada: node custom com view própria — necessária só se quiséssemos algo além de `<img>` (legenda, redimensionar); fora de escopo.

**Upload na inserção, não no salvar.** O anexo passa a existir antes de a citação existir: não há arquivo pendente em memória, não há rascunho de `localStorage` apontando para imagem que nunca subiu, e cancelar a modal não deixa o texto citando algo inexistente. O custo aceito é que inserir e cancelar deixa um anexo no card (visível na aba Anexos, removível). Alternativa considerada: subir no Salvar com preview por blob — rejeitada porque exigiria fila de pendências, resolução de citações temporárias no submit e interação frágil com o rascunho.

**Apresentação constrangida com limite de altura de 160 px.** No editor e na leitura, a figura usa largura máxima da coluna de texto, `max-height` de **160 px** (decidido com o usuário: miniatura bem pequena — a figura se lê de verdade no lightbox), `object-fit: contain` (proporção preservada, sem esticar imagem pequena), borda sutil e canto da família do card. O valor é um único token de CSS, fácil de ajustar depois. Alternativa considerada: largura total sem limite de altura — uma captura de tela 4K dominaria a descrição.

**Clique abre o lightbox do card, com a lista carregada sob demanda.** A área da descrição não conhece os anexos hoje (a aba Anexos é separada). A lista (`GET .../attachments`) é buscada uma vez quando **a descrição já cita figura**, quando o seletor abre ou quando o lightbox é acionado, e alimenta três decisões: se a citação ainda existe, se o formato pode ser exibido como imagem e as lâminas do lightbox — que reaproveitam `Lightbox` e `resolveAppUrl`. Nada é buscado para descrição sem figura. Alternativa considerada: carregar junto com a modal — paga requisição e estado de carregamento sempre. Descoberta na implementação: o mime do anexo é necessário **sem clique** para bloquear formato não exibível (SVG/PDF), então carregar só no clique não satisfazia a regra de exibição segura.

**Estado de imagem indisponível sem reescrever o texto.** Quando o arquivo falha (excluído, sem permissão, storage fora), a figura cai num cartão com o nome do arquivo e o motivo, no lugar da imagem — nunca ícone quebrado nem Markdown cru. A citação no Markdown **permanece** (o sistema não reescreve o texto do usuário em silêncio); quem quiser limpa à mão. Alternativa considerada: remover a citação automaticamente — silenciosa demais para uma decisão do usuário sobre o próprio texto.

**Aviso de citação por id do anexo contido na descrição.** A URL guardada no Markdown contém o id do anexo, então a aba Anexos consegue detectar citação procurando o id no texto da descrição, que a `ItemModal` já tem em estado e passa para a área. Alternativa considerada: token com id — preciso, mas rejeitado pelas razões acima; o risco de falso positivo de um UUID em prosa é desprezível.

**Contexto de anexos como prop opcional do editor.** `RichTextEditor` ganha prop opcional (`projectId`, `itemId`, `canEdit`) e só a `ItemModal` a fornece; sem ela, o botão de figura não aparece. Assim os outros cinco editores não mudam e o caminho para habilitá-los depois já existe. Upload e listagem são **extraídos** de `AttachmentsArea` para um módulo comum, em vez de duplicados.

**Permissão e capacidade.** O botão depende do papel (upload é `MEMBER`; `VIEWER` não insere) e da capacidade de anexos do tenant; a leitura da figura continua passando pela autorização do anexo. A `ItemModal` já calcula `currentUserRole`, mas o editor de descrição hoje não recebe nenhuma guarda — esta change passa a informá-lo.

### Como fica (mockup)

```
DESCRICAO                                        toolbar com [figura]
+------------------------------------------------------------------+
|  Faturando Sim/Nao como badge colorido: verde para sim e         |
|  vermelho para nao, bem destacado.                               |
|                                                                  |
|  +------------------------------------------------------------+  |
|  |                                                            |  |
|  |                 [ miniatura da figura ]                    |  |
|  |   largura da coluna, altura ate 160px, proporcao           |  |
|  |   preservada, borda sutil + canto arredondado              |  |
|  +------------------------------------------------------------+  |
|                                                                  |
|  Nos casos de excecao o badge cai para cinza, como abaixo.       |
+------------------------------------------------------------------+
                 |  clique (ou Tab + Enter)
                 v
+------------------------------------------------------------------+
|  [X]                                                      (ESC)  |
|            +--------------------------------------+              |
|            |          imagem ampliada             |              |
|            |        fundo escurecido, ~90%        |              |
|            +--------------------------------------+              |
|        <<      imagem 2 de 3 do card      >>                     |
+------------------------------------------------------------------+
```

## Risks / Trade-offs

- [A URL do anexo fica cravada no Markdown] → É a mesma URL que a aba Anexos já usa e os ids não são segredo; se a rota mudar, a normalização na renderização é o ponto único de ajuste.
- [Chunk do editor cresce] → `vendor-editor` tem ~11 KB de folga sobre o orçamento de 115000 B gzip; `bun run check:bundle` é o portão.
- [Turndown pode não devolver `![...]` como esperado] → Confirmado na implementação: a regra de `img` do core existe, mas trata a figura como inline e **cola figuras vizinhas** (`![a](x)![b](y)`), que o editor guarda como blocos — foi preciso uma regra explícita para figura em bloco (a filha do embrulho `<x-turndown>`). Coberto por teste de ida e volta.
- [Inserir e cancelar deixa anexo órfão no card] → Aceito por desenho; o anexo aparece na aba Anexos e é removível em um clique. Alternativa (subir no salvar) traria risco maior de estado inconsistente.
- [Aviso de citação depende de procurar o id no texto] → Falso positivo prático é desprezível; se incomodar, o caminho é um índice de citações, não um token no Markdown.
- [Testes de frontend que leem código-fonte reprovam no CI] → O verificador `check:frontend-tests` exige o marcador `[CONTRATO-ESTRUTURAL]` com justificativa; entra na verificação, junto de `check:i18n` (chaves novas em pt-BR/en/es).
- [Figura grande no editor de 120 px de altura] → O botão de expandir o editor já existe; abrir o editor expandido ao inserir figura é o ajuste natural (registrado como questão em aberto).
- [ESC do lightbox fechava também a modal do card] → Encontrado na conferência no board e corrigido: a modal escuta ESC em `window` na fase de bolha, então o lightbox passa a usar uma guarda em fase de captura que interrompe a propagação **e** fecha o lightbox por conta própria (`useLightboxEscapeGuard`), sem depender de como o lightbox trata ESC. A mesma guarda foi aplicada ao lightbox da aba Anexos, que tinha o mesmo defeito contra o cenário "fechar lightbox e retornar ao card".
- [Conteúdo legado com imagem hoje é perdido ao editar] → Depois desta change ele passa a ser preservado; não exige migração nem reescrita dos textos existentes.

## Migration Plan

Sem migration: nenhuma tabela, rota ou payload muda. O que muda é o comportamento do editor sobre conteúdo que já podia existir — descrições com `![...](...)` escritas por MCP passam a sobreviver à edição, o que é reparo retroativo, não quebra. Rollback é reverter o commit; anexos inseridos permanecem válidos na aba Anexos. `Board ref: 0f950723-b955-4b57-a442-970a72d2abe0` (card T87).

## Open Questions

- Ao excluir um anexo citado, oferecer também a limpeza da citação no texto? Hoje o desenho mantém o texto intacto e mostra o estado de removida; a ação de limpar pode vir depois.
- Habilitar o botão de figura nos editores de épico e história (que também são itens com anexos próprios): fica pronto pela prop, uso adiado.
