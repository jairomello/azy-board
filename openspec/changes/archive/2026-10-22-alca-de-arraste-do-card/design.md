# Design

## Context

Ver `proposal.md` — Why. Estado atual verificado no código em 22/10/2026:

- Em `apps/web/src/components/KanbanCard.tsx` (linhas ~136-189), o `useSortable` devolve `attributes`, `listeners`, `setNodeRef` e `setActivatorNodeRef`. A div raiz recebe apenas `setNodeRef` e o `style` (sem `role="button"`); a **alça** é a única que recebe `{...attributes}`, os `listeners` (só quando `card.isLeaf`) e `setActivatorNodeRef`. O arraste é desabilitado com `disabled: !card.isLeaf || card.type === 'EPIC'`.
- A alça monta a classe `px-1.5`, `select-none`, `transition-colors`, e a cor é `text-muted-foreground/25` no repouso ou `hover:text-muted-foreground/60`, com `cursor-grab active:cursor-grabbing`. Cards não arrastáveis usam `cursor-not-allowed` e `text-muted-foreground/20`.
- O símbolo é um `<svg width="10" height="16">` inline com seis `<circle r="1.5">` (dois por linha).
- A largura vem do CSS, não do JSX: `.kanban-card-grip { width: 17px; justify-content: center; }` em `apps/web/src/styles/globals.css` (linhas ~469-472), dentro de `@layer components`. O mesmo arquivo tem os tokens do board (`--board-*`, `--board-glow-*`) e as regras de tema `.dark .kanban-card`.
- O sensor do board é `PointerSensor` com `activationConstraint: { distance: 5 }` (`apps/web/src/features/board/BoardScreen.tsx:175`): um clique sem 5 px de movimento não inicia arraste. A alça fica **fora** da div de conteúdo que chama `openDetail`, então clique na alça não abre o card.
- As jornadas de e2e dependem de dois detalhes da alça: `e2e/journeys.ts` localiza o handle por `[title="Arrastar card"] svg` e inicia o arraste no centro desse SVG, após `scrollIntoView({ block: 'center' })`.
- A regressão visual compara telas críticas (`e2e/visual.ts`), mas o snapshot `board-simple` é capturado **antes** de criar qualquer card: a suíte visual não cobre o card nem a alça, e a etapa do CI é não-bloqueante (`continue-on-error: true`, "observação inicial").
- As regras `@media` do card cobrem densidade compacta (`.density-compact .kanban-card*`) e o tema escuro; a alça não tem regra responsiva própria.

## Goals / Non-Goals

**Goals:**

- Ampliar a área sensível ao ponteiro da alça para ~30 px, mantendo a altura total do card e a lateral esquerda.
- Trocar os pontos por uma seta de quatro pontas, oculta em repouso e visível quando o ponteiro entra no card.
- Entregar a visibilidade progressiva (ponteiro no card → seta visível; ponteiro na alça → destaque forte), incluindo o foco por teclado.
- Preservar, sem regressão: `title="Arrastar card"` e o `<svg>` interno, `cursor-grab`/`cursor-grabbing`, `role`/`tabIndex` do `useSortable`, clique para abrir o card, ações do topo e cards não arrastáveis.

**Non-Goals:**

- Tornar o card inteiro arrastável (o card todo como activator): conflitaria com clique-para-abrir, edição inline do título e as ações do topo.
- Faixa de arraste horizontal no topo do card: descartada na decisão com o usuário por colidir com a linha de ações.
- Alça no modal/detalhe do item, texto permanente "arrastar" no card ou tooltip novo.
- Mover ou reordenar por teclado de forma adicional: o que existe vem do `useSortable` e não muda.
- Alterar o sensor, o `activationConstraint` ou os endpoints de reorder.

## Decisions

**Rail de ~30 px com altura total, em vez de faixa no topo.** Decisão do usuário. Preserva as ações do topo (copiar/arquivar/excluir) e o clique-para-abrir sem exigir blindar os botões contra início de arraste, que é o que uma faixa superior de ponta a ponta exigiria. Alternativa considerada: faixa superior de largura total — alvo maior, mas colide com a linha de ações e com o clique no ícone/código.

**Símbolo `Move` do `lucide-react`.** Já é dependência do arquivo, renderiza um `<svg>` (contrato que o e2e usa) e comunica as quatro direções. Alternativa considerada: SVG inline próprio com quatro setas — mais código para manter, sem ganho sobre o ícone do catálogo já adotado pelo produto.

**Largura e estados no CSS (`globals.css`), não em utilitários.** A largura já vive em `.kanban-card-grip`, no `@layer components`, e os estados são pseudo-classes em cascata sobre `.kanban-card-grip--draggable`: o nível do ponteiro no card é um descendente em hover (`.kanban-card:hover .kanban-card-grip--draggable`, especificidade 0-3-0) e o forte é o próprio elemento em hover (`.kanban-card .kanban-card-grip--draggable:hover`, também 0-3-0). Como a especificidade empata, a **ordem** decide: o forte é declarado depois do nível do card. Alternativa considerada: utilitários do Tailwind (`group-hover:` + `hover:`) — mesma especificidade com ordem definida pelo bundle, o que torna o resultado menos previsível. O seletor do forte precisa ser `.kanban-card .kanban-card-grip--draggable:hover`; `.kanban-card-grip--draggable:hover` (0-2-0) perderia para o nível do card. A transição também saiu dos utilitários (`transition-colors`) para o CSS, para cobrir `opacity` junto de `color` e `background-color`.

**Nome acessível explícito.** Manter `title={t('dragCard')}` (contrato do e2e) e acrescentar `aria-label` com a mesma chave traduzida, preservando o `aria-describedby` que o dnd-kit injeta via `attributes`. Nenhuma chave nova de i18n.

**Seta oculta em repouso, revelada pelo ponteiro no card.** Decisão do usuário depois de testar no board em execução. Ocultar com `opacity: 0`, e não com `display: none` ou `visibility: hidden`, mantém o elemento no DOM e ativo para o dnd-kit — os `listeners`, o `setActivatorNodeRef` e o `title` que as jornadas de e2e usam continuam válidos —, preserva os 30 px da faixa (o conteúdo do card não se desloca quando a seta aparece) e permite a transição suave. Em dispositivos sem hover (`@media (hover: none)`) a seta permanece visível: ali o estado "ponteiro no card" nunca acontece e a alça ficaria sem pista nenhuma, agravando o problema de descoberta que originou a mudança. Alternativa considerada: esconder a seta também no toque — rejeitada por esse motivo.

## Risks / Trade-offs

- [Aumentar a área sensível pode capturar cliques destinados ao conteúdo] → A alça fica fora da div de conteúdo e o `activationConstraint: { distance: 5 }` exige movimento; verificar que clique abre o card e que os botões do topo seguem funcionando.
- [~13 px a menos de largura útil na coluna de 292 px] → Conferido por medição no board em execução: alça de 30 px e conteúdo de 232 px num card de 266 px, sem sobreposição com topo, breadcrumb, título, etiquetas e rodapé.
- [A seta oculta em repouso reduz a pista de que o card é arrastável] → Contrapeso: ela aparece ao primeiro contato com o card, a faixa de 30 px segue como alvo do arraste e, em dispositivo sem hover, a seta é exibida sempre. Se ainda houver relato de falta de descoberta, o caminho é reforçar o nível do ponteiro no card, não trazer a seta de volta ao repouso.
- [Nenhuma baseline visual cobre a alça] → Confirmado na implementação: o snapshot `board-simple` é de board vazio, e os baselines divergem por renderização do ambiente nesta máquina (o `login.png`, tela estática, também difere da baseline commitada). Nada foi regenerado; a alça fica vigiada pelo teste de componente, pelo script de board com medições e pelas jornadas de e2e que arrastam pela alça.
- [Alargar a alça e crescer o símbolo desloca o início do arraste no e2e] → O helper mira o centro do SVG e o símbolo segue centralizado na alça; rodar `bun run test:e2e` (jornadas de drag) depois da mudança.
- [Estados de hover não são verificáveis em jsdom] → Verificar os três estados nos dois temas no board em execução, com screenshot como evidência, e complementar com testes de componente para estrutura, símbolo e nome acessível.
- [Mais um ícone do `lucide-react` no chunk do board] → `bun run check:bundle`; o ícone entra no chunk que já contém o `KanbanCard` e outros ícones da mesma biblioteca.

## Migration Plan

Sem migração de dados, de API ou de payload: é o pacote visual do card. O deploy é a substituição dos artefatos web; o rollback é reverter o commit. Nenhuma baseline visual é regenerada (ver Riscos). `Board ref: 8afd60a1-2ab3-40de-8719-8e860de5287a` (card T85).

## Open Questions

- Clicar na alça sem arrastar deveria abrir o card? Hoje não abre e a mudança preserva isso. Com a área maior pode virar incômodo; é um ajuste pequeno e não altera specs, abordagem ou tasks.
