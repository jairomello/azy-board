## Why

O painel de filtros do Board já permite filtrar por squad, módulo, sprint, responsável, tipo e tag, mas ainda não oferece recortes fundamentais para acompanhar entregas: versão, prioridade, status e autor. Sem esses filtros, é difícil localizar rapidamente o trabalho de uma release, o que está bloqueado ou quem criou determinado item.

## What Changes

- Adicionar filtros por uma ou mais tags, versão, prioridade, status e autor no item **Filtros**.
- Manter a combinação dos filtros de conteúdo com lógica AND entre dimensões e OR dentro de seleções múltiplas da mesma dimensão.
- Exibir as opções disponíveis a partir dos dados já carregados do projeto, respeitando o modelo atual de versões.
- Tratar versão como vínculo opcional em `items.version_id`; qualquer `EPIC`, `STORY`, `TASK` ou `BUG` pode estar associado a no máximo uma versão.
- Persistir os novos filtros por projeto junto ao estado existente de filtros do Board.
- Manter filtros e estado visual compatíveis entre os modos `HIERARCHICAL` e `SIMPLE`.
- Adicionar ao formulário rápido de criação de task/bug um campo opcional de versão.
- Permitir que o `create_task` do MCP receba `versionId` opcional na criação, sem exigir uma segunda atualização.
- Validar server-side que a versão escolhida pertence ao mesmo projeto e tenant.
- Atualizar testes e documentação do Board para os novos critérios de filtragem.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `board-filters`: ampliar os filtros de conteúdo com tags, versão, prioridade, status e autor, incluindo as regras de combinação.
- `board-filters-persistence`: persistir e restaurar os novos campos de filtro por projeto.
- `card-creation-ui`: incluir versão opcional no formulário rápido de criação de cards.
- `mcp-server`: aceitar e validar `versionId` opcional no `create_task`.
- `mcp-ai-first-workflow`: permitir criação de itens já vinculados a uma versão.

## Impact

- Estado e componentes de filtros do frontend, incluindo controles responsivos e contagem de filtros ativos.
- Dados carregados pelo Board para versões, autores, tags e atributos dos itens.
- Possíveis ajustes em tipos compartilhados, derivação de cards e testes de contrato/UI.
- Payloads de criação rápida e MCP, com validação do vínculo de versão existente.
- Nenhuma migração de banco é necessária, pois versão, autor, prioridade e status já existem no modelo de `items`, e tags já possuem relação com os itens.
