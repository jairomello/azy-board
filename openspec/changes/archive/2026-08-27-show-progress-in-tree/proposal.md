## Why

A Tree View atualmente apresenta status e pontos, mas não oferece a leitura visual de progresso que já existe nos headers do Board Kanban. Isso dificulta acompanhar rapidamente a evolução de épicos, histórias e tasks sem abrir cada item ou alternar de visualização.

## What Changes

- Exibir barras de progresso na coluna **Progresso** da Tree View.
- Calcular o progresso de items agrupadores de forma acumulada a partir dos descendentes relevantes.
- Mostrar o progresso das tasks folha de acordo com seu status atual.
- Exibir percentual numérico junto à barra, com limites visuais entre 0% e 100%.
- Preservar a hierarquia, expansão/colapso, filtros, responsividade e modo simples da Tree View.
- Garantir que o cálculo siga as mesmas regras de progresso do Board e não conte items arquivados indevidamente.
- Adicionar testes e atualizar a documentação da Tree View.

## Capabilities

### New Capabilities

- `tree-progress`: exibição e cálculo de progresso individual e acumulado na Tree View.

### Modified Capabilities

- `tree-view`: incluir barra e percentual de progresso nas linhas de items.
- `epic-tracking`: alinhar o cálculo de progresso acumulado entre Board e Tree View.

## Impact

- `TreeViewPage`, tipos de `TreeNode`/progresso e componentes de linha.
- Endpoint de árvore ou derivação client-side responsável por progresso acumulado.
- Regras de status, Leaf Rule, filtros e exclusão de items arquivados do cálculo.
- Testes de progresso em folhas, STORYs, EPICs, subtasks, modo simples e responsividade.
