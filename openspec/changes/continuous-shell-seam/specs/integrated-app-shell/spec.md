# Spec Delta

## ADDED Requirements

### Requirement: Continuidade visual da emenda entre sidebar e header
Em viewports `lg+`, o header SHALL se estender por trás do canto arredondado da sidebar o suficiente para que nenhum fundo de canvas apareça entre a curva e a borda esquerda do header. A posição do conteúdo do header SHALL permanecer a mesma, e o layout abaixo de `lg` SHALL permanecer inalterado.

#### Scenario: Sem vão claro no encontro
- **WHEN** o shell é exibido em viewport `lg+`
- **THEN** a área entre a curva superior direita da sidebar e o header é preenchida pela superfície do header
- **AND** nenhum tom de canvas ou lacuna clara aparece na emenda

#### Scenario: Conteúdo do header alinhado
- **WHEN** o header é estendido para trás da curva
- **THEN** breadcrumb, título e controles do header mantêm a mesma posição horizontal de antes
- **AND** a emenda continua sem sobrepor o conteúdo da sidebar

#### Scenario: Layout mobile inalterado
- **WHEN** o usuário acessa uma tela protegida em viewport menor que `lg`
- **THEN** header, conteúdo e drawer mantêm os espaçamentos e a composição atuais

#### Scenario: Temas e presets
- **WHEN** o usuário alterna entre modo claro, escuro ou presets de shell
- **THEN** a emenda permanece contínua, com as cores e a curva coerentes com o preset ativo
