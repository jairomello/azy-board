## ADDED Requirements

### Requirement: Board e Settings devem possuir fronteiras modulares
O frontend SHALL organizar as responsabilidades de Board e configurações do projeto em features separadas, com componentes e hooks agrupados por domínio, e SHALL manter `BoardPage` e `SettingsPage` como adaptadores finos de rota.

#### Scenario: Abrir o Board pela rota existente
- **WHEN** um usuário autorizado acessa `/projects/:projectId/board`
- **THEN** a rota monta a feature do Board com o mesmo `projectId`, permissões, query params e comportamento funcional da implementação anterior

#### Scenario: Abrir Settings pela rota existente
- **WHEN** um usuário autorizado acessa `/projects/:projectId/settings`
- **THEN** a rota monta a feature de configurações com o mesmo `projectId`, permissões, traduções e seções disponíveis conforme o modo do projeto

### Requirement: A feature do Board deve separar dados, interação e apresentação
O módulo de Board SHALL separar, por interfaces tipadas, o carregamento de dados e catálogos, filtros e agrupamentos, sincronização em tempo real, drag-and-drop, mutações, árvore e modais, sem duplicar chamadas de API nem alterar os contratos existentes.

#### Scenario: Carregar um projeto do Board
- **WHEN** `projectId` é definido ou alterado
- **THEN** a feature carrega os dados e catálogos do projeto através do cliente `api`, descarta estado do projeto anterior e preserva os filtros e preferências escopados ao projeto

#### Scenario: Receber uma atualização em tempo real
- **WHEN** `useWebSocket` ou `onAssistantMutation` sinaliza uma mutação relevante
- **THEN** o módulo responsável dispara o refresh ou atualização existente sem exigir que o shell conheça os detalhes do evento

#### Scenario: Mover um card por drag-and-drop
- **WHEN** o usuário conclui um drag-and-drop válido em uma coluna ou posição permitida
- **THEN** a feature usa o mesmo fluxo de mutação, regras de item folha, atualização visual e tratamento de erro da implementação anterior

### Requirement: A feature de configurações deve isolar cada seção
O módulo de configurações SHALL fornecer componentes e estado independentes para formato/visibilidade, planejamento, colunas, gerente, membros e squads, centros de custo, módulos, sprints e versões, mantendo a autorização e os endpoints atuais.

#### Scenario: Editar uma seção sem interferir nas demais
- **WHEN** o usuário abre, edita ou salva uma seção de configurações
- **THEN** somente o estado e o carregamento da seção afetada são alterados, sem resetar formulários ou dados de outras seções abertas

#### Scenario: Usuário sem permissão acessa Settings
- **WHEN** um usuário sem permissão de administração acessa a rota de configurações
- **THEN** a feature mantém a mensagem e o bloqueio de acesso existentes, sem expor controles de mutação

#### Scenario: Projeto SIMPLE oculta módulos
- **WHEN** a configuração do projeto indica o modo `SIMPLE`
- **THEN** a feature omite a seção de módulos e preserva as demais seções e operações disponíveis

### Requirement: A refatoração deve preservar contratos de integração
Os módulos extraídos SHALL continuar usando o cliente `api`, os hooks de sincronização, os contratos de i18n e os tipos compartilhados existentes, sem introduzir endpoints, payloads, dependências ou estado global incompatíveis.

#### Scenario: Falha de uma operação de configuração
- **WHEN** uma chamada de mutação de Settings falha
- **THEN** o módulo exibe o tratamento de erro traduzido existente e preserva o estado do formulário para nova tentativa

#### Scenario: Troca de projeto durante a montagem
- **WHEN** o usuário navega de um projeto para outro enquanto dados estão sendo carregados
- **THEN** os módulos associam respostas, preferências e eventos ao `projectId` correto e não exibem dados do projeto anterior

### Requirement: Os módulos extraídos devem ser verificáveis por testes de comportamento
Cada módulo extraído SHALL possuir testes que cubram seus estados e interações críticas, e os testes SHALL preferir comportamento observável a assertions baseadas apenas no texto-fonte.

#### Scenario: Validar uma seção extraída
- **WHEN** o teste renderiza uma seção com cliente API e estado controlados
- **THEN** consegue verificar carregamento, sucesso, erro e callback de mutação sem importar a página monolítica

#### Scenario: Validar o shell da página
- **WHEN** o teste renderiza o shell com uma feature mockada
- **THEN** confirma que `projectId`, permissões, filtros/eventos e callbacks são encaminhados sem duplicar a lógica interna dos módulos
