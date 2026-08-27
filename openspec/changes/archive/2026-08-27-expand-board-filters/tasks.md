## 1. Modelo De Filtros

- [x] 1.1 Ampliar `BoardFilterState` com `versionId`, `priority`, `status` e `authorId`, mantendo `tagIds` e defaults compatíveis.
- [x] 1.2 Garantir que itens e cards carregados pelo Board exponham `versionId`, `authorId`, prioridade, status e tags necessários para filtragem.
- [x] 1.3 Derivar opções de versões e autores somente do projeto/tenant atual e manter os valores de prioridade e status válidos.
- [x] 1.4 Propagar a lista de versões do projeto ao formulário rápido de criação e ao fluxo de criação do MCP.

## 2. Aplicação Dos Filtros

- [x] 2.1 Adicionar controles de versão, prioridade, status e autor ao painel `Filtros`, preservando o controle múltiplo de tags.
- [x] 2.2 Aplicar filtros por tag, versão, prioridade, status e autor sobre os itens em memória sem novas consultas ao alterar controles.
- [x] 2.3 Implementar combinação AND entre dimensões e OR entre tags selecionadas da mesma dimensão.
- [x] 2.4 Tratar itens sem vínculo como não correspondentes quando o respectivo filtro estiver ativo.
- [x] 2.5 Manter os novos filtros disponíveis no modo `SIMPLE` e ocultar somente filtros incompatíveis, como módulo quando aplicável.
- [x] 2.6 Adicionar versão opcional ao `AddCardForm` e ao payload de criação rápida, mantendo `Sem versão` como padrão.
- [x] 2.7 Adicionar `versionId` opcional ao `create_task` do MCP e validar o vínculo no backend pelo projeto/tenant.

## 3. Persistência E Estado Visual

- [x] 3.1 Persistir e restaurar os novos campos em `board-filters:<projectId>` com compatibilidade para estados antigos ou parciais.
- [x] 3.2 Limpar os novos filtros ao executar "Limpar filtros", preservando `showSubtasks`, `storyDisplay` e `moduleViewMode`.
- [x] 3.3 Limpar automaticamente a versão persistida quando ela não existir mais no projeto, sem remover outros filtros.
- [x] 3.4 Atualizar contagem/indicador de filtros ativos e estados vazios para incluir os novos critérios.

## 4. Testes E Documentação

- [x] 4.1 Adicionar testes de contrato/UI para renderização, seleção, limpeza e combinação dos novos filtros.
- [x] 4.2 Adicionar testes para persistência, restauração, estados antigos, versão removida e `localStorage` inválido/indisponível.
- [x] 4.3 Adicionar testes de regressão para filtros nos modos `HIERARCHICAL` e `SIMPLE`, incluindo tags com semântica OR.
- [x] 4.4 Atualizar README/wiki e catálogo de filtros com tag, versão, prioridade, status e autor, incluindo a modelagem `items.version_id`.
- [x] 4.5 Executar typecheck, lint, testes e build, corrigindo regressões antes de concluir.
- [x] 4.6 Atualizar documentação do formulário de criação e do MCP para explicar o vínculo opcional de versão.
