## Purpose

Definir a identificação do projeto atual no contexto de navegação do Board.

## Requirements

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

---

### Requirement: Nome do projeto no header abre a modal de planejamento
O nome do projeto exibido no header do board SHALL ser um controle interativo acessível por mouse e teclado. Ao ser acionado, SHALL abrir a modal de Planejamento do Projeto do projeto atual, sem navegar para outra rota.

#### Scenario: Acionar o nome do projeto
- **WHEN** o usuário clica no nome do projeto no header do board
- **THEN** a modal de Planejamento do Projeto abre para o projeto atual

#### Scenario: Acionar por teclado
- **WHEN** o controle do nome do projeto recebe foco e o usuário o ativa por teclado
- **THEN** a modal de Planejamento do Projeto abre para o projeto atual, com foco visível

#### Scenario: Nome indisponível
- **WHEN** o nome do projeto não está disponível no header
- **THEN** nenhum controle de abertura é exibido, mantendo o comportamento atual de fallback
