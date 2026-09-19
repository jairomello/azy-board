## MODIFIED Requirements

### Requirement: Página de configurações de conta
O sistema SHALL disponibilizar a rota `/account` como uma página protegida por autenticação que centraliza as configurações pessoais do usuário. A página SHALL exibir o nome e e-mail do usuário no topo, conter a seção de foto de perfil, a seção de preferências de visibilidade de projetos e a seção de API Keys.

#### Scenario: Acesso autenticado à página de conta
- **WHEN** um usuário autenticado navega para `/account`
- **THEN** a página é exibida com nome, e-mail, a seção de foto de perfil, a preferência "Mostrar projetos ocultos" e a seção de API Keys

#### Scenario: Acesso não autenticado redireciona para login
- **WHEN** um usuário não autenticado acessa `/account`
- **THEN** o sistema redireciona para a tela de login

#### Scenario: Botão de voltar na página de conta
- **WHEN** o usuário clica no botão de voltar
- **THEN** o sistema navega para `/projects`

## ADDED Requirements

### Requirement: Edição da foto de perfil na página de conta
A página `/account` SHALL exibir a foto atual do usuário (ou o avatar por iniciais) acompanhada de controles para alterar e remover a foto. O fluxo de alteração SHALL usar o editor de recorte antes do envio. Os textos novos SHALL estar disponíveis nos três idiomas (pt-BR, en, es) no namespace `settings`, e os controles SHALL ser acessíveis por teclado.

#### Scenario: Alterar a foto
- **WHEN** usuário aciona o controle de alterar foto na seção de perfil
- **THEN** o sistema abre o editor de recorte e, após a confirmação, atualiza a foto exibida sem recarregar a página

#### Scenario: Remover a foto
- **WHEN** usuário aciona o controle de remover foto
- **THEN** a foto é descartada e o avatar por iniciais volta a ser exibido

#### Scenario: Estado sem foto
- **WHEN** usuário não possui foto cadastrada
- **THEN** a seção de perfil exibe o avatar por iniciais com a opção de adicionar foto

#### Scenario: Falha no upload
- **WHEN** o upload ou a normalização falha
- **THEN** o sistema mantém a aplicação utilizável, exibe mensagem de erro e preserva a foto anterior

#### Scenario: Controles acessíveis
- **WHEN** usuário navega por teclado pela seção de perfil
- **THEN** consegue acionar os controles de alterar e remover foto e recebe retorno de foco/estado
