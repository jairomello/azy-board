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

### Requirement: Edição do nome de exibição na página de conta
A página `/account` SHALL permitir que o usuário autenticado edite seu próprio nome de exibição, mantendo o e-mail (login) imutável e somente leitura. O nome SHALL ser validado com remoção de espaços nas extremidades e tamanho entre 1 e 200 caracteres; nomes não SHALL ser únicos. A atualização SHALL ser escopada ao usuário autenticado e ao tenant ativo, e os textos novos SHALL existir nos três idiomas (pt-BR, en, es) no namespace `settings`.

#### Scenario: Salvar um novo nome válido
- **WHEN** o usuário altera o nome no campo de exibição e confirma
- **THEN** o sistema persiste o novo nome e o reflete imediatamente no perfil, no avatar por iniciais e demais exibições do usuário, sem exigir novo login

#### Scenario: Rejeitar nome vazio ou acima do limite
- **WHEN** o usuário confirma um nome vazio, apenas espaços ou com mais de 200 caracteres
- **THEN** o sistema rejeita a operação com mensagem de validação e não altera o nome atual

#### Scenario: E-mail permanece imutável
- **WHEN** o usuário abre a página de conta
- **THEN** o e-mail é apresentado como somente leitura e nenhuma requisição enviada pela página pode alterá-lo

#### Scenario: Tentativa de alterar o nome de outro usuário
- **WHEN** uma requisição tenta atualizar o nome de um usuário diferente do autenticado
- **THEN** o sistema ignora o alvo informado, aplica a alteração apenas ao usuário autenticado no tenant ativo e responde sem expor dados de outro usuário

#### Scenario: Falha ao persistir o nome
- **WHEN** a atualização remota do nome falha
- **THEN** o sistema mantém a aplicação utilizável, preserva o valor anterior e comunica a falha com nova tentativa possível

#### Scenario: Campo acessível por teclado
- **WHEN** o usuário navega por teclado pela seção de perfil
- **THEN** consegue focar o campo de nome, editar e acionar o salvamento, recebendo retorno de estado de foco e de sucesso ou erro

### Requirement: Orientação de conexão do MCP na seção de API Keys

A página `/account` SHALL incluir, na seção de API Keys, a orientação de conexão do MCP do Azy Board (explicação da finalidade da chave, URL do MCP e instrução para o code agent), sem alterar as seções existentes de perfil, aparência e visibilidade de projetos.

#### Scenario: Orientação na seção de API Keys

- **WHEN** um usuário autenticado abre `/account`
- **THEN** a seção de API Keys exibe a orientação de conexão do MCP junto das demais seções da página

### Requirement: Seção de senha na página de conta
A página `/account` SHALL apresentar uma seção **Senha** para o usuário alterar a própria senha, com campos de senha atual, nova senha e confirmação, e uma ação de salvar. A seção SHALL ficar visível apenas quando o provedor de autenticação da instalação for local e SHALL exibir, quando o provedor for integrado, uma indicação de que a senha é gerenciada por esse provedor, sem campos de troca.

#### Scenario: Observar a seção com login local
- **WHEN** o usuário autenticado abre `/account` em uma instalação com provedor local
- **THEN** a página mostra a seção Senha com os campos senha atual, nova senha, confirmação e a ação de salvar

#### Scenario: Seção oculta com provedor integrado
- **WHEN** o usuário autenticado abre `/account` em uma instalação com provedor Microsoft ou Google
- **THEN** a página não exibe campos de troca de senha e informa que a senha é gerenciada pelo provedor integrado

#### Scenario: Troca de senha pela página de conta
- **WHEN** o usuário preenche senha atual, nova senha e confirmação válidas e aciona salvar
- **THEN** o sistema envia a troca ao servidor, exibe confirmação de sucesso e limpa os campos do formulário

#### Scenario: Erro exibido no formulário
- **WHEN** o servidor rejeita a troca por senha atual incorreta, política de senha ou confirmação divergente
- **THEN** a página exibe a mensagem de erro correspondente e mantém os campos editáveis

#### Scenario: Estado de envio
- **WHEN** a troca de senha está em andamento
- **THEN** a ação de salvar fica indisponível durante o envio, impedindo envios duplicados

### Requirement: Posição da seção de senha na página de conta

A página `/account` SHALL exibir a seção de senha imediatamente após o bloco de identidade (nome de exibição, e-mail e foto de perfil) e antes da seção de Aparência, mantendo as demais seções e a ordem relativa entre elas. A posição SHALL ser a mesma quando a seção apenas informa que a senha é gerenciada por um provedor de autenticação integrado.

#### Scenario: Senha logo após o bloco de identidade
- **WHEN** um usuário autenticado abre `/account`
- **THEN** a seção de senha aparece imediatamente após o bloco com nome, e-mail e foto de perfil, e antes de Aparência

#### Scenario: Demais seções preservadas
- **WHEN** a seção de senha muda de posição
- **THEN** Aparência, Visibilidade do projeto e Chaves de API continuam presentes e mantêm entre si a ordem anterior

#### Scenario: Mesma posição com provedor integrado
- **WHEN** a instalação usa provedor de autenticação integrado e a seção de senha apenas informa que a senha é gerenciada fora do Azy Board
- **THEN** essa indicação permanece na mesma posição, logo após o bloco de identidade

