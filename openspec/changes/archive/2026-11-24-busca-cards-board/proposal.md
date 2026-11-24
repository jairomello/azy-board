# Proposal

## Why

Hoje o board só permite localizar cards percorrendo colunas, abrindo épicos/histórias ou montando filtros por atributos. Não há busca textual por título, código sequencial (`T#`/`B#`) ou responsável, então encontrar um card específico em um projeto grande depende de varredura visual e de conhecer previamente o módulo, a sprint ou o status.

O card **T92 — Busca de cards no board** pede um campo de pesquisa na parte superior do board, tolerante a acentos e caixa, combinável com os filtros ativos e com limpeza que restaura a visão filtrada. A busca precisa funcionar independentemente da visualização (Board, Unificado e Árvore) e servir tanto para recortar a visão quanto para abrir diretamente o card encontrado.

## What Changes

- Adicionar um campo de busca no **topo direito do header** do board, disponível em Board, Unificado e Árvore.
- Buscar **client-side** sobre os itens já carregados do projeto, por **título**, **`sequenceCode`** e **responsável**, sem nova chamada HTTP.
- Normalizar acentos e caixa; aceitar múltiplos termos (AND) e código com `#`/espaços (`#T92`, `T 92`).
- No **Board** e no **Unificado**, a busca recorta os cards exibidos em conjunto com os filtros ativos (AND); subtasks entram mesmo com “Mostrar subtasks” desligado; lanes/épicos/histórias vazios são ocultados e ramos recolhidos são expandidos temporariamente.
- Na **Árvore**, a busca filtra a grade mantendo os ancestrais necessários e abre os ramos com resultado.
- Exibir um **dropdown de resultados** com código, título, status, responsável e breadcrumb; navegação por setas, abertura com Enter/clique e fechamento com Escape.
- Limpar a busca restaura a visão filtrada anterior, sem alterar os filtros ativos.
- Estado vazio explícito com a consulta e ação de limpar; estado de carregamento enquanto a base do projeto não chegou.
- Atalho `Ctrl/Cmd+K` para focar a busca, com versão mobile por ícone no header.
- **Sem** mudança de API, banco, MCP, permissões ou migrações. A busca não é persistida entre recargas e não entra no estado de filtros.

## Capabilities

### New Capabilities

- `board-card-search`: busca textual de cards no header do board, com recorte combinado aos filtros, resultados navegáveis e comportamento equivalente nas três visões.

### Modified Capabilities

Nenhuma. A busca é uma capacidade nova e não altera o contrato de `board-filters`; ela apenas compõe o recorte já existente.

## Impact

- Web: novo modelo puro (`cardSearch`, `treeSearch`), novo componente de header (`CardSearch`), slot `headerSearch` no `AppShell`, estado e recorte em `BoardScreen`, filtro da grade em `TreeViewPage` e chaves de i18n pt-BR/en/es.
- Sem alteração de contrato REST, banco, MCP, worker ou realtime.
- Orçamento de bundle: o componente e o modelo entram no chunk do `BoardPage`; o build deve continuar dentro dos limites ou o teto deve ser ajustado com justificativa.
- **Board ref:** `06365ddb-d7a5-4a13-a7b3-61e5603a40a4` (T92).
