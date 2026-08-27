## 1. Estado E Opções

- [x] 1.1 Adicionar `costCenterId` ao `BoardFilterState` com valor vazio como padrão.
- [x] 1.2 Propagar a lista de Centros de Custo do projeto ao `BoardFilters` e derivar opções do tenant/projeto atual.
- [x] 1.3 Renderizar o filtro sempre, exibindo `Todos os centros` e `Nenhum centro de custo cadastrado` quando não houver opções.

## 2. Aplicação E Persistência

- [x] 2.1 Filtrar itens em memória por `costCenterId` sem nova consulta à API e combinar o critério com os demais filtros usando AND.
- [x] 2.2 Incluir Centro de Custo na contagem, limpeza e estados do painel, mantendo compatibilidade com boards `SIMPLE` e `HIERARCHICAL`.
- [x] 2.3 Persistir e restaurar `costCenterId` por projeto e limpar a seleção quando o Centro de Custo for removido.

## 3. Testes E Documentação

- [x] 3.1 Adicionar testes de contrato/UI para filtro com múltiplos Centros de Custo e projeto sem Centros cadastrados.
- [x] 3.2 Testar combinação com outros filtros, persistência, limpeza e seleção inválida/removida.
- [x] 3.3 Atualizar documentação do Board e executar typecheck, lint, testes e build.
