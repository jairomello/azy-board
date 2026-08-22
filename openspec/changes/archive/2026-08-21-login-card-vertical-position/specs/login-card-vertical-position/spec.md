## ADDED Requirements

### Requirement: Card de login compacto e centralizado

O sistema SHALL renderizar o card da tela de login com altura natural baseada no conteúdo e centralizá-lo verticalmente na área disponível em telas desktop, mantendo espaço visual semelhante acima e abaixo do card.

#### Scenario: Card centralizado em desktop

- **WHEN** a tela é exibida em viewport desktop com altura suficiente
- **THEN** o card fica centralizado verticalmente e não ocupa toda a altura da viewport

#### Scenario: Painéis com altura compartilhada

- **WHEN** o card é renderizado com os painéis institucional e de formulário
- **THEN** os dois painéis compartilham a altura natural do grid sem o formulário ser esticado artificialmente

### Requirement: Layout responsivo sem overflow indevido

O sistema SHALL preservar o uso da tela de login em mobile e tablet, permitindo rolagem vertical apenas quando o conteúdo realmente exceder a altura disponível.

#### Scenario: Tela mobile

- **WHEN** a viewport está em largura mobile
- **THEN** o card permanece dentro das margens horizontais e todo o formulário continua acessível sem corte

#### Scenario: Viewport baixa

- **WHEN** a altura da viewport é menor que a altura natural do card
- **THEN** a página permite rolagem vertical e não oculta o início ou o fim do formulário
