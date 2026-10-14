## Purpose

Definir os requisitos da capacidade integrated-app-shell.

## Requirements

### Requirement: Shell desktop integrado em duas colunas
O sistema SHALL apresentar, em viewports desktop (`lg+`), uma sidebar iniciando no topo e ocupando toda a altura util a esquerda, enquanto o header contextual inicia ao lado dela na coluna principal. Sidebar e header SHALL formar uma composicao superior visualmente continua, com cantos externos, bordas, espacamentos e sombras coerentes.

#### Scenario: Desktop expandido
- **WHEN** o usuario acessa uma tela protegida em viewport com largura igual ou superior a `1280px`
- **THEN** a sidebar exibe simbolo e wordmark AzyBoard em sua faixa superior, usa a largura expandida e se estende do topo ao rodape do shell
- **AND** o header contextual inicia a direita da sidebar

#### Scenario: Desktop compacto
- **WHEN** o usuario acessa uma tela protegida em viewport entre `lg` e `1279px`
- **THEN** a sidebar permanece desde o topo em largura compacta e exibe o simbolo da marca sem wordmark
- **AND** os itens de navegacao continuam acessiveis por tooltip

#### Scenario: Marca nao duplicada no desktop
- **WHEN** a sidebar desktop esta visivel
- **THEN** o header contextual nao renderiza uma segunda marca AzyBoard
- **AND** breadcrumb, titulo, `headerMeta`, idioma, tema e perfil permanecem disponiveis

### Requirement: Continuidade do workspace principal
O sistema SHALL preservar a area principal do `AppShell`, incluindo os slots opcionais `commandBar` e `statusRail`, sem sobreposicao, corte ou perda do comportamento de scroll apos a integracao do header com a sidebar. Em telas associadas a um projeto, o titulo contextual principal SHALL exibir o nome do projeto limitado visualmente a 60 caracteres; quando o projeto nao estiver disponivel, SHALL manter o `contextLabel` como fallback.

#### Scenario: Pagina com command bar e status rail
- **WHEN** uma pagina fornece `commandBar` e `statusRail`
- **THEN** ambos aparecem na coluna principal, abaixo do header e nas posicoes atuais relativas ao conteudo
- **AND** somente a regiao apropriada da pagina rola dentro da altura disponivel

#### Scenario: Pagina sem slots opcionais
- **WHEN** uma pagina nao fornece `commandBar` ou `statusRail`
- **THEN** o conteudo utiliza o espaco disponivel sem lacunas reservadas para esses slots

#### Scenario: Nome do projeto no header
- **WHEN** uma tela project-scoped possui `projectId` e `projectName`
- **THEN** o titulo contextual principal exibe o nome do projeto em vez do texto generico de fluxo

#### Scenario: Nome maior que 60 caracteres
- **WHEN** o nome do projeto possui mais de 60 caracteres
- **THEN** o texto visual e truncado para no maximo 60 caracteres
- **AND** o nome completo permanece disponivel por tooltip ou atributo acessivel

#### Scenario: Tela sem projeto
- **WHEN** uma tela global nao possui projeto atual
- **THEN** o header mantem o `contextLabel` e nao reutiliza o nome de projeto anterior

### Requirement: Navegacao mobile preservada
O sistema SHALL manter abaixo de `lg` um header de largura total com botao de menu, marca, contexto da pagina e controles globais, e SHALL continuar abrindo a sidebar como drawer sobreposto.

#### Scenario: Mobile com drawer fechado
- **WHEN** o usuario acessa uma tela protegida em viewport menor que `lg`
- **THEN** a sidebar fixa nao ocupa espaco lateral
- **AND** o header exibe botao de menu e marca AzyBoard

#### Scenario: Mobile abre e fecha navegacao
- **WHEN** o usuario aciona o botao de menu
- **THEN** o drawer da sidebar abre abaixo do header com overlay, navegacao e controle de fechamento
- **AND** fecha ao navegar, acionar o controle de fechamento ou clicar no overlay

### Requirement: Compatibilidade visual e acessivel
O shell integrado SHALL usar os tokens existentes de sidebar e header, funcionar nos presets `petroleum`, `ocean`, `emerald`, `graphite` e `classic`, funcionar no modo escuro e preservar contraste, foco visivel e semantica das regioes de navegacao.

#### Scenario: Alternancia de tema
- **WHEN** o usuario alterna entre modo claro, modo escuro ou outro preset claro
- **THEN** sidebar, header, estados ativos e controles atualizam seus tokens sem quebrar a composicao integrada

#### Scenario: Navegacao por teclado
- **WHEN** o usuario navega pelo shell usando teclado
- **THEN** links e controles recebem foco visivel em ordem logica
- **AND** menus, tooltips e drawer mantem seus labels acessiveis

### Requirement: Contrato publico do AppShell preservado
O sistema SHALL manter as props publicas atuais de `AppShell` e a compatibilidade com todas as paginas protegidas consumidoras.

#### Scenario: Paginas existentes usam o novo shell
- **WHEN** Board, Dashboard, Settings, Projetos, Conta ou Admin renderizam `AppShell`
- **THEN** nenhuma pagina precisa alterar seu contrato de chamada para obter a nova composicao

### Requirement: Ordem dos itens globais de navegação da sidebar
O sistema SHALL apresentar, na sidebar do `AppShell`, o item `Conta` antes do grupo `Admin`, de forma que `Admin` seja o **último** item da navegação quando visível. O grupo `Admin` SHALL continuar condicionado a `canAccessAdmin(user.globalGroup)`, permanecendo visível apenas para os grupos `ADMIN` e `ROOT`, e SHALL permanecer ausente para os demais grupos.

#### Scenario: Admin e Root veem Conta antes de Admin
- **WHEN** um usuário com grupo global `ADMIN` ou `ROOT` acessa a aplicação
- **THEN** o item `Conta` é renderizado antes do grupo `Admin`
- **AND** o grupo `Admin` é o último item da sidebar

#### Scenario: Submenu de Admin permanece agrupado ao final
- **WHEN** um usuário com grupo global `ADMIN` ou `ROOT` expande o grupo `Admin`
- **THEN** os sub-itens `Usuários` e `Anexos` são renderizados sob o grupo `Admin`
- **AND** para `ROOT`, o sub-item `Config. Tenant` (`/admin/assistant`) também é renderizado sob o grupo `Admin`
- **AND** o grupo `Admin` continua sendo o último item da sidebar, após `Conta`

#### Scenario: Grupo sem permissão não vê Admin
- **WHEN** um usuário com grupo global `TEAM_MEMBER` ou `MANAGER` acessa a aplicação
- **THEN** o grupo `Admin` não é renderizado
- **AND** o item `Conta` permanece visível na navegação

---

### Requirement: Exibição da versão do build na sidebar

A sidebar do shell SHALL exibir a versão e a data do build abaixo de "Trabalho
conectado" nas viewports em que a sidebar estendida é exibida. O texto SHALL ser
internacionalizado e não SHALL competir com os itens de navegação.

#### Scenario: Versão visível abaixo de "Trabalho conectado"

- **WHEN** um usuário autenticado acessa uma tela protegida com a sidebar estendida visível
- **THEN** a versão `YYYY.MM.DD.N` e a data do build aparecem abaixo de "Trabalho conectado"

#### Scenario: Versão traduzida

- **WHEN** a sidebar é exibida em PT-BR, EN ou ES
- **THEN** o rótulo da versão aparece no idioma ativo

### Requirement: Header e seus popovers acima da workspace
O header do shell, incluindo os popovers internos que ele hospeda (perfil, idioma e tema), SHALL pintar acima do slot `commandBar` e do conteúdo da área principal da página.

#### Scenario: Menu do perfil aberto sobre a command bar
- **WHEN** o usuário abre o menu do perfil em uma página que fornece o slot `commandBar`
- **THEN** o menu é exibido integralmente acima da command bar
- **AND** todos os itens, inclusive o primeiro, ficam legíveis e clicáveis

#### Scenario: Seletor de idioma e alternador de tema
- **WHEN** o usuário abre o seletor de idioma ou o alternador de tema na mesma página
- **THEN** o popover correspondente também é exibido acima da command bar

#### Scenario: Página sem command bar
- **WHEN** a página não fornece o slot `commandBar`
- **THEN** os popovers do header continuam funcionando como antes, sem mudança de posição

### Requirement: Slot commandBar acima do conteúdo da página
O slot `commandBar` SHALL pintar acima do conteúdo da área principal, e os popovers que a command bar abre SHALL permanecer visíveis sobre esse conteúdo.

#### Scenario: Popovers da command bar sobre o board
- **WHEN** o usuário abre filtros, opções ou o menu de criação na command bar do board
- **THEN** o popover é exibido acima das colunas e dos cartões
- **AND** a rolagem do conteúdo não o cobre

### Requirement: Overlays globais acima do header
Modais de diálogo e o drawer mobile de navegação SHALL pintar acima do header e de seus popovers.

#### Scenario: Modal aberto sobre o header
- **WHEN** um modal de diálogo é aberto a partir de uma página com `commandBar`
- **THEN** o modal e seu fundo escurecido cobrem o header, a command bar e o conteúdo

#### Scenario: Drawer mobile sobre o header
- **WHEN** o usuário abre a navegação no mobile
- **THEN** o drawer e seu overlay ficam acima do header

### Requirement: Sidebar acima do header
A sidebar desktop SHALL permanecer acima do header na ordem de empilhamento, preservando a composição visualmente contínua entre os dois.

#### Scenario: Composição desktop preservada
- **WHEN** o shell é exibido em viewport `lg` ou maior
- **THEN** a emenda visual entre sidebar e header continua sem sobreposição indevida de sombra, borda ou canto
