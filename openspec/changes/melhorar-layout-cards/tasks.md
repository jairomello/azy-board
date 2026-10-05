## 1. Preparação

- [x] 1.1 Mapear o acoplamento atual: `grep` por `KanbanCard` em testes e guardas `[CONTRATO-ESTRUTURAL]` (`check:frontend-tests`), identificando testes que dependem do UUID truncado, do badge de tipo no rodapé e do breadcrumb abaixo do título
- [x] 1.2 Conferir os tokens disponíveis em `apps/web/src/styles/globals.css` (`--card`, `--border`, `--ring`, `--status-*`) e a referência visual `docs/prototipos/cards-t32/01-essencial.svg` (estados normal e hover)

## 2. Estrutura do KanbanCard

- [x] 2.1 Reescrever a raiz do card mantendo `setNodeRef`, transform/transition de arraste, `border-l-[3px]` por `STATUS_INDICATOR` (cor = status), borda discreta, raio 10 px e superfície `--card`
- [x] 2.2 Implementar a linha de topo em grid (`23px / minmax(0,1fr) / 84px`): alça de arraste (mantendo `setActivatorNodeRef` + listeners + Leaf Rule), ícone do item com `card.color` (23 px) e `sequenceCode` curto truncável, sem UUID truncado
- [x] 2.3 Tornar a coluna reservada de ações condicional à presença de handlers (`onArchive`/`onDelete`/`onOpenDetail`), preservando o alinhamento quando não houver ações
- [x] 2.4 Mover o breadcrumb para linha própria acima do título, com `truncate` e tooltip completo via `createPortal` (mantendo gatilhos de foco/teclado quando aplicável)
- [x] 2.5 Aplicar o título em destaque (semibold, `line-clamp-2`), preservando edição inline (`InlineEdit`) e clique com `scheduleOpenDetail`/`stopPropagation`
- [x] 2.6 Implementar a linha de etiquetas: tags com `flex-wrap` e `min-w-0` à esquerda, etiqueta textual única de tipo à direita (reutilizando `TYPE_STYLES` e chaves i18n existentes), removendo o badge de tipo do rodapé
- [x] 2.7 Manter a região de progresso de checklists entre etiquetas e rodapé, visível somente quando `checklistProgress.total > 0`
- [x] 2.8 Implementar o rodapé com divisor (`border-top` com `--border`) e campos condicionais na ordem prioridade → pontos → subtarefas (`GitBranch` + contagem, tooltip) → avatar do responsável (`margin-left: auto`), omitindo metadados ausentes

## 3. Ações do card

- [x] 3.1 Mover as ações para a área reservada do topo (remover o overlay `absolute`), exibindo copiar referência → arquivar → excluir nessa ordem, com botões de 26 px
- [x] 3.2 Garantir visibilidade em hover (`group-hover`) e foco por teclado (`group-focus-within`), com `pointer-events` coerentes e `focus-visible` usando `outline` com `--ring`
- [x] 3.3 Preservar comportamento e permissões: `stopPropagation` em todos os botões, confirmação de exclusão (`window.confirm`), ícones e `title`/`aria-label` existentes, renderização condicional por handler
- [x] 3.4 Verificar que cliques nas ações não abrem o card nem iniciam o arraste (validar com arraste real via dnd-kit)

## 4. Compatibilidade e i18n

- [x] 4.1 Validar o layout no tema claro e no tema escuro usando apenas tokens existentes
- [x] 4.2 Validar a densidade compacta do board e o comportamento em boards SIMPLE e HIERARCHICAL (breadcrumb longo truncando, tags quebrando linha)
- [x] 4.3 Revisar chaves i18n usadas (PT-BR/EN/ES): reaproveitar existentes; se algum rótulo novo for inevitável, adicionar as três traduções

## 5. Testes e verificação

- [x] 5.1 Atualizar os testes de frontend acoplados à estrutura antiga e os guardas `[CONTRATO-ESTRUTURAL]` para a nova hierarquia de regiões
- [x] 5.2 Adicionar/ajustar testes cobrindo os cenários da spec: topo sem UUID, código ao lado do ícone, breadcrumb acima do título, tipo único na linha de etiquetas, rodapé condicional, ações em hover/foco
- [x] 5.3 Rodar `bun run check` (typecheck + lint + testes + build) e corrigir apontamentos
- [x] 5.4 Rodar `bun run test:smoke` (fluxo web/API) e conferir `check:bundle` (orçamento de bundle do board)
- [x] 5.5 Verificação visual manual comparando com `01-essencial.svg`: card normal e hover/foco, com e sem ícone/código/tags/pontos/subtarefas/responsável

## 6. Encerramento

- [x] 6.1 Registrar resultado no card T32 do Azy Board (Board ref: `94cadbe5-42ec-4748-a1b3-2802715148a4`) com `create_item_log`
- [x] 6.2 Mover o card T32 para `Concluídas` com `complete_task` e confirmar `status = DONE` no board real
