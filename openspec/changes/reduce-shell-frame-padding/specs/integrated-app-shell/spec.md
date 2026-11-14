# Spec Delta

## ADDED Requirements

### Requirement: Moldura externa compacta do shell no desktop
Em viewports `lg+`, o shell SHALL manter uma moldura externa de 4 px entre a sidebar/header e as bordas da janela, aproximando as superfícies das bordas sem encostá-las. A emenda visual contínua entre sidebar e header SHALL ser preservada, e o layout abaixo de `lg` SHALL permanecer inalterado.

#### Scenario: Moldura compacta no desktop
- **WHEN** o usuário acessa uma tela protegida em viewport `lg+`
- **THEN** sidebar e header ficam a 4 px das bordas superior, esquerda, direita e inferior da janela
- **AND** permanece um vão visível entre as superfícies e as bordas, sem encostar

#### Scenario: Emenda entre sidebar e header preservada
- **WHEN** o shell é exibido em viewport `lg+`
- **THEN** o header continua encostado na borda direita da sidebar, sem vão nem sobreposição sobre o conteúdo da sidebar
- **AND** os cantos, bordas e sombras externas permanecem coerentes com a composição integrada

#### Scenario: Layout mobile inalterado
- **WHEN** o usuário acessa uma tela protegida em viewport menor que `lg`
- **THEN** header, conteúdo e drawer mantêm os espaçamentos atuais em relação às bordas

#### Scenario: Workspace sem corte ou sobreposição
- **WHEN** uma página fornece `commandBar`, conteúdo e `statusRail` no desktop
- **THEN** os slots continuam posicionados abaixo do header e à direita da sidebar
- **AND** o scroll interno da página permanece restrito à região apropriada, sem corte causado pela moldura menor
