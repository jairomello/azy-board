## ADDED Requirements

### Requirement: Nome do projeto exibido no breadcrumb do board
O sistema SHALL exibir o nome do projeto aberto no breadcrumb do header do board, no formato `Projetos › Board · <Nome do Projeto>`. O nome SHALL ser carregado via `GET /projects/:projectId` junto com os demais dados de inicialização do board.

#### Scenario: Breadcrumb exibe nome do projeto após carregamento
- **WHEN** o usuário abre o board de um projeto
- **THEN** o header exibe o breadcrumb `Projetos › Board · <Nome do Projeto>`, onde "Projetos" é um link para `/projects` e "Board · <Nome>" está em destaque

#### Scenario: Breadcrumb durante carregamento inicial
- **WHEN** o board está carregando (spinner visível)
- **THEN** o breadcrumb não é exibido (a tela de loading cobre o header)

#### Scenario: Fallback quando nome não está disponível
- **WHEN** a chamada `GET /projects/:projectId` falha ou retorna nome vazio
- **THEN** o breadcrumb exibe apenas `Projetos › Board`, sem o separador `·` ou nome

#### Scenario: Título da aba do browser reflete o projeto
- **WHEN** o nome do projeto é carregado com sucesso
- **THEN** `document.title` é definido como `<Nome do Projeto> · Board`

#### Scenario: Título da aba revertido ao sair do board
- **WHEN** o componente `BoardPage` é desmontado (usuário navega para outra página)
- **THEN** `document.title` retorna ao valor padrão da aplicação
