## Why

O layout atual do `KanbanCard` dispersa metadados em posições imprevisíveis (tipo repetido duas vezes, UUID truncado como referência visível, ícone embutido na linha do breadcrumb) e as ações de cartão ficam sobrepostas ao conteúdo no hover. O card **T32 — Melhorar layout dos cards** aprova o estudo visual **01 — Essencial** (`docs/prototipos/cards-t32/01-essencial.svg`), que organiza a leitura em faixas previsíveis dentro da coluna de 292 px, alinhado às diretrizes de componentes de card (NN/g) e de espaçamento/drag-and-drop (Atlassian).

**Board ref:** `94cadbe5-42ec-4748-a1b3-2802715148a4` (T32 - Melhorar layout dos cards, coluna "A Fazer").

## What Changes

- **Nova estrutura visual do KanbanCard** (proposta 01 — Essencial), mantendo a coluna de 292 px, superfície `--card`, borda discreta, cantos arredondados (10 px) e faixa lateral de 3 px na cor do **status** (comportamento atual preservado).
- **Linha de topo** reorganizada: alça de arraste, ícone do item (figura e cor configuradas) e código curto (`T32`, `B2`), com área reservada de ~84 px no canto superior direito para as ações. Sem ícone ou código, o alinhamento é mantido sem inventar conteúdo (fim do UUID truncado como conteúdo do card).
- **Breadcrumb movido para acima do título** (antes: abaixo), com truncamento e consulta do caminho completo mantidos.
- **Título em destaque**: peso semibold, até duas linhas na visualização padrão, truncamento sem invadir outras áreas; edição inline e clique para abrir detalhes preservados.
- **Linha de etiquetas**: tags à esquerda (com quebra de linha controlada) e uma única etiqueta textual de tipo à direita (Tarefa/Bug etc.), eliminando a repetição atual do tipo.
- **Região opcional de progresso de checklist** entre etiquetas e rodapé, visível somente quando houver itens.
- **Rodapé com divisor sutil**: prioridade, pontos (quando informados), indicador e contagem de subtarefas (quando houver) e avatar do responsável (quando houver); metadados ausentes são omitidos sem reservar espaço.
- **Ações no hover e no foco por teclado**: copiar referência, arquivar e excluir, nessa ordem, na área reservada do topo, sem cobrir ícone, código, breadcrumb, título ou tags; permissões, confirmação de exclusão e comportamento atuais preservados; cliques não abrem o card nem iniciam arraste; nomes acessíveis e foco visível.
- **Compatibilidade**: temas claro/escuro, densidade compacta e boards SIMPLE e HIERARCHICAL.

Sem mudanças de backend, API ou modelo de dados.

## Capabilities

### New Capabilities

- `kanban-card-layout`: estrutura visual e estados do card do Kanban conforme a proposta 01 — Essencial (linha de topo, breadcrumb, título, etiquetas, progresso, rodapé, área de ações e compatibilidade de tema/densidade).

### Modified Capabilities

- `card-management`: o requisito de breadcrumb no card passa a exigir o caminho **acima do título** (mantendo truncamento e tooltip); o requisito de `sequenceCode` passa a exibir o código curto na linha de topo e **remove o fallback de UUID truncado** (nada é inventado quando não há código).
- `task-hierarchy`: o cenário de breadcrumb truncado no card passa a considerar o caminho exibido **acima do título** (truncamento e tooltip mantidos).
- `card-edit-ui`: o indicador de progresso de checklists deixa de ser descrito como parte do rodapé e passa a ocupar região própria entre etiquetas e rodapé (visibilidade condicional mantida).

## Impact

- **Código**: `apps/web/src/components/KanbanCard.tsx` (reestruturação principal); possivelmente `apps/web/src/features/board/components/BoardColumns.tsx` (largura da coluna) e `apps/web/src/styles/globals.css` (tokens/estilos); chaves de i18n em `apps/web/src/i18n` (PT-BR/EN/ES) se novos rótulos forem necessários.
- **Testes**: testes de frontend existentes que referenciam a estrutura do card (incluindo guardas `[CONTRATO-ESTRUTURAL]` do `check:frontend-tests`) e testes E2E do fluxo do board (`bun run test:smoke`).
- **Contratos**: nenhum (`CardData` em `KanbanCard.tsx` já contém todos os campos usados: `sequenceCode`, `icon`, `color`, `itemTags`/`taskTags`, `childrenCount`, `checklistProgress`, `assignee`).
- **Documentação**: referência visual em `docs/prototipos/cards-t32/01-essencial.svg` e contexto em `docs/prototipos/cards-t32/README.md`.
