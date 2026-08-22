## 1. Estado E Persistência

- [x] 1.1 Adicionar `moduleViewMode: 'hierarchy' | 'tabs'` ao `BoardFilterState` e ao `DEFAULT_FILTERS`, usando `hierarchy` como padrão.
- [x] 1.2 Atualizar leitura e persistência de `board-filters:<projectId>` para aceitar dados antigos sem `moduleViewMode`.
- [x] 1.3 Adicionar estado do módulo/aba ativa no `BoardPage`, selecionando o primeiro grupo válido e corrigindo a seleção quando os grupos mudarem.

## 2. Controle De Visualização

- [x] 2.1 Adicionar ao painel de filtros um controle segmentado `Hierarquia` / `Abas`, visível para a visualização Board.
- [x] 2.2 Propagar `moduleViewMode` e o callback de alteração entre `BoardPage`, `BoardCommandBar` e `BoardFilters`.
- [x] 2.3 Adicionar traduções PT-BR, EN e ES para os modos, rótulos de abas e estado `Sem módulo`.

## 3. Renderização Por Abas

- [x] 3.1 Extrair a renderização de um grupo de módulo para uma função/componente compartilhado pelos modos Hierarquia e Abas.
- [x] 3.2 Implementar tabs horizontais no modo `tabs`, usando `moduleGroups` e exibindo apenas o grupo ativo.
- [x] 3.3 Renderizar a aba virtual `Sem módulo` quando houver conteúdo sem módulo e ocultar módulos sem épicos elegíveis.
- [x] 3.4 Garantir que filtros, drag-and-drop, criação, edição e estados de colapso funcionem nos dois modos.

## 4. Validação

- [x] 4.1 Executar `bun run typecheck`, `bun run build:web` e `git diff --check`.
- [ ] 4.2 Testar alternância Hierarquia/Abas e persistência após recarregar o projeto.
- [ ] 4.3 Testar navegação entre módulos, módulo sem módulo e filtros aplicados no modo Abas.
- [ ] 4.4 Testar responsividade das tabs em desktop, tablet e mobile.
