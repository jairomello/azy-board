# Tasks

## 1. Alça ampliada com seta de quatro pontas

- [x] 1.1 Trocar o símbolo de seis pontos pelo ícone `Move` do `lucide-react` em `apps/web/src/components/KanbanCard.tsx`, preservando `title={t('dragCard')}`, o `<svg>` interno e as classes `cursor-grab active:cursor-grabbing` — verificado por teste de componente que localiza a alça por `title="Arrastar card"` e confirma o SVG da seta de quatro pontas
- [x] 1.2 Ampliar `.kanban-card-grip` para ~30 px em `apps/web/src/styles/globals.css` (`@layer components`), mantendo a altura total do card e o `justify-content: center` — verificado no board em execução, medindo a largura da alça (~30 px) e conferindo que topo, breadcrumb, título, etiquetas, progresso e rodapé não são cobertos, na densidade confortável e na compacta
- [x] 1.3 Preservar o comportamento dos cards não arrastáveis (EPIC e TASK/BUG com filhos): alça visível na largura nova, com cursor de indisponível e sem `listeners` — verificado por teste de componente do estado não arrastável
- [x] 1.4 Garantir o nome acessível da alça com `aria-label` traduzido pela chave `dragCard` (pt-BR/en/es), preservando o `aria-describedby` do dnd-kit — verificado por asserção de acessibilidade no teste de componente e por `bun run check:i18n`

## 2. Destaque progressivo

- [x] 2.1 Definir o estado de repouso da seta, discreto e legível nos temas claro e escuro, com tom mais perceptível que os ~25 % atuais e apoiado nos tokens do board — verificado no board em execução, nos dois temas, com screenshot do estado de repouso
- [x] 2.2 Implementar o destaque intermediário no ponteiro sobre o card (`.kanban-card:hover .kanban-card-grip`) e o forte no ponteiro sobre a alça (`.kanban-card .kanban-card-grip:hover`), com o forte declarado depois do intermediário por empatar em especificidade — verificado no board em execução, com screenshot dos três estados nos dois temas
- [x] 2.3 Aplicar o mesmo destaque forte ao foco por teclado (`focus-visible`) na alça — verificado navegando o board por teclado até a alça e registrando a evidência visual
- [x] 2.4 Conferir que o destaque forte não altera ações do topo, título, etiquetas e rodapé, e que o hover do card continua funcionando nas demais regiões — verificado no board em execução e por inspeção das regras em `apps/web/src/styles/globals.css`

## 3. Verificação integrada

- [x] 3.1 Conferir a alça no board em execução, já que a suíte visual não captura card algum (`e2e/visual.ts` tira o snapshot `board-simple` antes de criar cards, e os baselines diferem por renderização do ambiente nesta máquina — nenhum baseline foi regenerado) — verificado por script dedicado contra stack descartável: alça de 30 × 162 px, conteúdo sem sobreposição com topo, breadcrumb, título, etiquetas e rodapé, e computed styles distintos nos três estados, nos temas claro e escuro
- [x] 3.2 Rodar `bun run test:e2e` e confirmar que as jornadas de drag continuam verdes com a alça maior e o símbolo novo, já que elas localizam a alça por `[title="Arrastar card"] svg` e arrastam a partir do centro do SVG
- [x] 3.3 Rodar `bun run check` (typecheck + lint + testes + build) e `bun run check:bundle` para confirmar o orçamento do chunk do board com o ícone novo

## 4. Ajuste pós-teste: seta oculta em repouso (substitui o estado de repouso das tasks 2.1 e 2.2)

- [x] 4.1 Ocultar a seta em repouso e revelá-la quando o ponteiro entra no card, mantendo o destaque forte no ponteiro sobre a alça e no foco por teclado — verificado por teste de componente das regras de CSS (`opacity: 0` em repouso, `opacity: 1` no nível do card e no forte) e por computed styles no board em execução
- [x] 4.2 Manter a seta visível em dispositivos sem hover (`@media (hover: none)`), preservando os 30 px da faixa e o elemento no DOM (listeners do dnd-kit e `title` do e2e) — verificado por asserção de CSS no teste de componente e por `bun run test:e2e`, cuja jornada arrasta pela alça
- [x] 4.3 Rever os estados no board em execução, nos temas claro e escuro — verificado por script dedicado: opacidade 0 em repouso, opacidade 1 com o ponteiro no card e cor primária com faixa com o ponteiro na alça
- [x] 4.4 Rodar `bun run check` e `bun run check:bundle` para confirmar typecheck, lint, testes e orçamento do chunk do board

## Workflow follow-up

- Card **T85** (`8afd60a1-2ab3-40de-8719-8e860de5287a`) está no `Backlog`: ao iniciar a implementação, mova-o para `Fazendo` com `move_task` e reivindique-o com `claim_task` (hoje está sem responsável). Não comece enquanto a confirmação de coluna com `baseStatus = IN_PROGRESS` e de responsável não passar.
- Fechar o card **T85** com `complete_task` e confirmar no board real que ele está em coluna com `baseStatus = DONE` — encerrar a change não encerra o card; registre também os tokens de IA consumidos (`set_item_tokens`).
- Arquivar a change após sincronizar a delta para `openspec/specs/kanban-card-layout/` e conferir o resultado em `openspec/changes/archive/`.
