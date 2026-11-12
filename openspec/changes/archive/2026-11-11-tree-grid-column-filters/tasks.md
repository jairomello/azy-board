# Tasks

> Change retroativa: documenta comportamento já entregue no PR #11 (`1944bad`, `32bebb1`, `1f1af59`, `1ac422f`).

## 1. Filtros por coluna

- [x] 1.1 Mapear as colunas Status, Responsável, Prioridade, Sprint, Versão e Centro de Custo para o estado de filtros do board.
- [x] 1.2 Exibir menu de filtro no cabeçalho, com indicador de filtro ativo e fechamento por clique fora ou Escape.
- [x] 1.3 Aplicar o filtro combinado por AND com os demais filtros.

## 2. Limpar filtros

- [x] 2.1 Expor a ação de limpar filtros com contagem de ativos na command bar e na Tree View.
- [x] 2.2 Preservar `showSubtasks`, `storyDisplay`, `moduleViewMode` e a visualização atual ao limpar.

## 3. Criação inline

- [x] 3.1 Inserir formulário mínimo abaixo da linha, com tipos compatíveis com a hierarquia.
- [x] 3.2 Confirmar pela criação existente e cancelar sem persistir.
- [x] 3.3 Ocultar a ação para Viewer.

## 4. Desfazer arquivamento

- [x] 4.1 Exibir toast com ação "Desfazer" após arquivar.
- [x] 4.2 Restaurar o item e invalidar os caches do board e da árvore.

## 5. Verificação

- [x] 5.1 Testar filtros por coluna, command bar e criação inline.
- [x] 5.2 Testar o toast e o desfazer do arquivamento.
