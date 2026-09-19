## Purpose

Definir as preferências de aparência e idioma disponíveis na área de conta do usuário.
## Requirements
### Requirement: Preferência de sessão para mostrar projetos ocultos
O sistema SHALL disponibilizar, no dropdown do avatar e na página `/account`, um controle "Mostrar projetos ocultos" que alterna a exibição de projetos ocultos na listagem de projetos. O controle SHALL iniciar desligado em cada sessão, SHALL ser reiniciado para desligado em todo login e logout e SHALL NÃO ser persistido em banco de dados nem em `localStorage`.

#### Scenario: Preferência desligada ao autenticar
- **WHEN** o usuário autentica na aplicação
- **THEN** o controle "Mostrar projetos ocultos" está desligado

#### Scenario: Alternar pelo dropdown do avatar
- **WHEN** o usuário aciona o controle no dropdown do avatar
- **THEN** a preferência é alternada para a sessão atual e a listagem de projetos reflete o novo valor

#### Scenario: Alternar pela página de conta
- **WHEN** o usuário aciona o controle na seção de preferências de `/account`
- **THEN** a preferência é alternada e o valor é o mesmo exibido no dropdown do avatar

#### Scenario: Preferência é reiniciada no login
- **WHEN** o usuário faz logout e autentica novamente
- **THEN** a preferência volta a estar desligada, independentemente do valor anterior

#### Scenario: Armazenamento indisponível
- **WHEN** o navegador bloqueia o acesso ao armazenamento de sessão
- **THEN** a preferência permanece utilizável durante a sessão em memória, a aplicação continua funcional e nenhum erro é exibido ao usuário

### Requirement: Dropdown de perfil no avatar do usuário
O sistema SHALL exibir um menu dropdown ao clicar no `UserAvatar` em qualquer header da aplicação. O dropdown SHALL conter o controle "Mostrar projetos ocultos" e as opções "Configurações da conta" e "Sair".

#### Scenario: Abrir dropdown no header da página de projetos
- **WHEN** o usuário clica no avatar na `ProjectsPage`
- **THEN** um menu dropdown é exibido com o controle "Mostrar projetos ocultos" e as opções "Configurações da conta" e "Sair"

#### Scenario: Abrir dropdown no header do board
- **WHEN** o usuário clica no avatar na `BoardPage`
- **THEN** um menu dropdown é exibido com o controle "Mostrar projetos ocultos" e as opções "Configurações da conta" e "Sair"

#### Scenario: Navegar para configurações de conta
- **WHEN** o usuário clica em "Configurações da conta" no dropdown
- **THEN** o sistema navega para a rota `/account`

#### Scenario: Sair pelo dropdown
- **WHEN** o usuário clica em "Sair" no dropdown
- **THEN** o sistema encerra a sessão e redireciona para a tela de login

#### Scenario: Alternar projetos ocultos pelo dropdown
- **WHEN** o usuário aciona "Mostrar projetos ocultos" no dropdown
- **THEN** o estado do controle é alternado e a listagem de projetos é recarregada considerando o novo valor

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

### Requirement: Seção de preferências de aparência
A página `/account` SHALL apresentar uma seção **Aparência** antes da seção de API Keys, contendo o modo claro/escuro e os temas estruturais do modo claro.

#### Scenario: Consultar aparência
- **WHEN** o usuário abre `/account`
- **THEN** a seção mostra o modo atual e os presets Petróleo, Oceano, Esmeralda, Grafite e Clássico
- **AND** o preset ativo possui check, nome e preview visual

#### Scenario: Escolher preset por teclado
- **WHEN** o foco está no grupo de presets
- **THEN** o usuário pode percorrer as opções por teclado e confirmar a seleção
- **AND** o controle expõe semântica de radio group ou equivalente acessível

#### Scenario: Escolher preset durante o modo escuro
- **WHEN** o usuário seleciona um preset claro enquanto o modo escuro está ativo
- **THEN** a escolha é salva
- **AND** a interface informa que o preset será aplicado ao retornar ao modo claro

#### Scenario: Falha ao persistir preferência
- **WHEN** a atualização remota falha
- **THEN** o sistema mantém a aplicação utilizável
- **AND** comunica a falha e oferece nova tentativa

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

