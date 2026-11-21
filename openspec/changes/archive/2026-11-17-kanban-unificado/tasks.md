# Tasks

## 1. Visualização

- [x] 1.1 Adicionar `unified` ao tipo de visualização da tela (`BoardView`), ao lado de `kanban` (Board) e `tree` (Árvore).
- [x] 1.2 Expor `Board`, `Unificado` e `Árvore` no seletor da command bar, mantendo `Board` como visualização inicial e sem alterar o Kanban em lanes.
- [x] 1.3 Mapear `Unificado` para `kanban` no contexto do assistente, sem mudar o contrato `AssistantViewCommand`.
- [x] 1.4 Manter `Opções` e `Criar` disponíveis no `Unificado`, escondendo apenas os controles exclusivos de lane.

## 2. Seleção e ordenação

- [x] 2.1 Criar `selectUnifiedCards`, que entrega todo o recorte em uma lista e coloca cards sem coluna na primeira coluna do fluxo.
- [x] 2.2 Desempatar `sortBoardItemsByPosition` por código e título para posições concorrentes entre histórias.

## 3. Tela e componentes

- [x] 3.1 Criar `UnifiedBoard` com cabeçalho de recorte, estado vazio e `BoardColumns` em `laneId="unified"`.
- [x] 3.2 Renderizar o `UnifiedBoard` quando a visualização for `unified`, sem abas de módulo nem lanes.
- [x] 3.3 Abrir a criação contextual da coluna pelo botão **Adicionar card** do `Unificado`.
- [x] 3.4 Manter arraste, overlay, vaga de destino, caminho crítico e contadores funcionando no quadro único.
- [x] 3.5 Adicionar textos em pt-BR, en e es.

## 4. Testes

- [x] 4.1 Cobrir `UnifiedBoard`: cards de épicos diferentes na mesma faixa, colunas únicas, contagem, criação contextual e recorte vazio.
- [x] 4.2 Cobrir `selectUnifiedCards` (card sem coluna, ausência de colunas) e o desempate de ordenação.
- [x] 4.3 Cobrir o seletor com as três visualizações e a preservação do Kanban em lanes.
- [x] 4.4 Garantir que os testes web existentes do Board continuam verdes.

## 5. Verificação e documentação

- [x] 5.1 Rodar `bun run typecheck`, `bun run lint` e os testes web afetados.
- [ ] 5.2 Rodar `bun run check` e `bun run test:smoke` — bloqueado no ambiente (path com espaço em `teamsIntegration` e credenciais de smoke ausentes).
- [x] 5.3 Criar a change OpenSpec com proposal, design, tasks e delta de spec.
- [x] 5.4 Atualizar CHANGELOG e wiki (Board, controles de visualização e swimlanes).
- [x] 5.5 Validar `bun run openspec:validate` e `bun run check:docs`.
