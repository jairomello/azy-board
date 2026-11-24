# Tasks

**Board ref:** `06365ddb-d7a5-4a13-a7b3-61e5603a40a4` (T92)

## 1. Preparação

- [x] 1.1 Mover o T92 de Backlog para Fazendo e assumir o card.
- [x] 1.2 Criar worktree local sem espaços (`azyboard-busca`) e copiar os `.env` locais não versionados.
- [x] 1.3 Registrar baseline local: `bun run check` com 2144 testes passando e build verde.

## 2. OpenSpec

- [x] 2.1 Criar a change `busca-cards-board` com proposal, tasks e delta `ADDED` da capability `board-card-search`.
- [x] 2.2 Registrar o `Board ref` do T92 nos artefatos.
- [ ] 2.3 Rodar `bun run openspec:validate` e `bun run check:docs`.

## 3. Modelo de busca

- [x] 3.1 Implementar normalização, matching por título/código/responsável, ranking e breadcrumb em `cardSearch`.
- [x] 3.2 Implementar o filtro hierárquico da Árvore em `treeSearch`, preservando ancestrais.
- [x] 3.3 Integrar a busca ao recorte do board (`selectBoardCards`, `selectProgressPopulation`, `selectStoryVirtualCards`, `buildEpicGroups`).
- [x] 3.4 Cobrir modelo e recorte com testes unitários.

## 4. Header e componente

- [x] 4.1 Adicionar o slot `headerSearch` ao `AppShell`, no cluster da direita.
- [x] 4.2 Implementar `CardSearch` com dropdown, teclado, atalho, versão mobile e acessibilidade.
- [x] 4.3 Integrar o componente ao `BoardScreen` e abrir o detalhe do card pelo resultado.
- [x] 4.4 Adicionar as chaves de i18n em pt-BR, en e es.

## 5. Board e Árvore

- [x] 5.1 Aplicar o recorte da busca no Board e no Unificado, combinado com os filtros.
- [x] 5.2 Ocultar lanes vazias, expandir ramos e ignorar abas de módulo durante a busca.
- [x] 5.3 Aplicar a busca à grade da Árvore, preservando ancestrais e abrindo os ramos com resultado.
- [x] 5.4 Exibir estado vazio explícito com consulta e ação de limpar nas duas visões.
- [x] 5.5 Garantir que a busca não entre em `BoardFilterState` nem no contador de filtros.

## 6. Testes e gates

- [x] 6.1 Testes de interação do `CardSearch` (digitar, setas, Enter, Escape, limpar, carregando, atalho).
- [x] 6.2 Teste do slot `headerSearch` no `AppShell`.
- [x] 6.3 Testes do recorte do board e do filtro da Árvore.
- [x] 6.4 Rodar `bun run check` (typecheck, lint, persistência, boundary, testes e build).
- [x] 6.5 Rodar `bun run test:smoke`.
- [x] 6.6 Rodar `bun run check:bundle`, `bun run check:i18n` e `bun run check:frontend-tests`.
- [x] 6.7 Rodar `bun run openspec:validate` e `bun run check:docs`.

## 7. Validação funcional local

- [x] 7.1 Subir a aplicação local e criar cards de teste (título, código e responsável distintos).
- [x] 7.2 Validar busca por código exato/prefixo, título com acento e responsável.
- [x] 7.3 Validar múltiplos termos, subtasks, lanes recolhidas e combinação com filtros.
- [x] 7.4 Validar Board, Unificado e Árvore, incluindo troca de visão com a consulta ativa.
- [x] 7.5 Validar estado vazio, limpeza, `Ctrl/Cmd+K`, setas/Enter/Escape e ausência de requisições ao digitar.
- [x] 7.6 Validar layout mobile e temas claro/escuro.
- [x] 7.7 Registrar evidências da validação local.

## 8. Encerramento

- [x] 8.1 Apresentar diff, evidências e instruções de teste ao Lincoln.
- [x] 8.2 Autorização explícita recebida após teste local; push e PR liberados.
- [ ] 8.3 Após aprovação e merge, arquivar a change OpenSpec e concluir o T92 com tokens registrados.
