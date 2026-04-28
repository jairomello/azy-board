## MODIFIED Requirements

### Requirement: Tree View funcional ao alternar visualização
O sistema SHALL renderizar a Tree View como tabela hierárquica expansível quando o usuário seleciona "Árvore" no seletor de visualização, substituindo completamente o board Kanban.

#### Scenario: Alternar para Tree View
- **WHEN** usuário clica no botão "Árvore" no seletor de visualização
- **THEN** o board Kanban desaparece completamente e é substituído pela Tree View; os dados são buscados via `GET /projects/:id/tree`

#### Scenario: Estrutura hierárquica exibida
- **WHEN** Tree View é carregada
- **THEN** raiz exibe módulos; cada módulo expande para épicos; cada épico para histórias; cada história para tasks; cada task para subtasks (se houver)

#### Scenario: Expandir e colapsar nós
- **WHEN** usuário clica no ícone de expandir/colapsar de um nó
- **THEN** filhos do nó são exibidos ou ocultados; todos os outros nós permanecem no estado atual

#### Scenario: Colunas de dados nas tasks
- **WHEN** linha de task ou subtask é exibida na Tree View
- **THEN** as seguintes colunas são visíveis: Nome, Status (badge colorido), Responsável (avatar), Pontos, Progresso (%), Data Início, Data Fim

#### Scenario: Botões Expandir tudo / Recolher tudo
- **WHEN** usuário clica em "Expandir tudo"
- **THEN** todos os nós da árvore são expandidos simultaneamente

#### Scenario: Retornar ao Kanban
- **WHEN** usuário clica no botão "Kanban" no seletor de visualização
- **THEN** Tree View é substituída pelo board Kanban com os filtros anteriores preservados
