## 1. Cálculo De Progresso

- [x] 1.1 Definir helper server-side para calcular progresso de folhas `TASK`/`BUG` e agregadores, seguindo status `DONE` e intervalo 0–100.
- [x] 1.2 Integrar o cálculo bottom-up ao endpoint `/projects/:projectId/items/tree`, após aplicar tenant, itens não arquivados e filtros.
- [x] 1.3 Cobrir raízes de módulos, EPICs, STORYs, TASKs/BUGs com filhos e STORY fixa do modo `SIMPLE`.

## 2. Interface Da Tree View

- [x] 2.1 Atualizar tipos de `TreeNode`/linha para consumir progresso calculado e proteger a largura da barra entre 0% e 100%.
- [x] 2.2 Exibir barra visual e percentual numérico para folhas e itens agrupadores, incluindo estado 0% sem folhas concluídas.
- [x] 2.3 Preservar colunas, expansão/colapso, filtros, modo simples, responsividade e acessibilidade da tabela.

## 3. Testes E Documentação

- [x] 3.1 Adicionar testes de API para folha concluída/não concluída, agregação parcial, agrupador sem folhas e exclusão de arquivados.
- [x] 3.2 Adicionar testes para progresso filtrado, Tree View em modo `SIMPLE` e consistência com o cálculo do Board.
- [x] 3.3 Adicionar testes de contrato/UI para barra, percentual, limites e regressão visual da Tree View.
- [x] 3.4 Atualizar documentação da Tree View e das regras de progresso.
- [x] 3.5 Executar typecheck, lint, testes e build, corrigindo regressões antes de concluir.
