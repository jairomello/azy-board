# Spec Delta

## ADDED Requirements

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
