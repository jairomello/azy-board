# Spec Delta

## MODIFIED Requirements

### Requirement: Paleta do Board nos temas claro e escuro
O Board SHALL aplicar superfícies, bordas, realces e sombras inspirados nos SVGs claro e escuro de referência por meio de tokens compatíveis com o tema efetivo, mantendo contraste de texto e controles. No modo claro, a nuance de fundo, a borda e o realce sutil do **card** SHALL acompanhar o preset de shell claro escolhido. As demais superfícies do Board (canvas, colunas, barra de comandos, filtros e contexto) SHALL permanecer independentes dos presets. No modo escuro, o card SHALL manter a paleta escura própria do Board, sem variação por preset.

#### Scenario: Card no tema claro acompanha o preset do shell
- **WHEN** o tema efetivo é claro e o usuário troca o preset de shell claro
- **THEN** a nuance de fundo, a borda e o realce do card passam a refletir a cor do preset escolhido, sem reload

#### Scenario: Board no tema claro
- **WHEN** o tema efetivo da aplicação é claro
- **THEN** canvas, colunas, filtros e estados de interação apresentam a paleta clara do protótipo, com brilho e contornos discretos que não competem com os cards
- **AND** a nuance do card acompanha o preset claro ativo

#### Scenario: Board no tema escuro
- **WHEN** o tema efetivo da aplicação é escuro
- **THEN** canvas, colunas, filtros e estados de interação apresentam a paleta escura correspondente, com contornos e realces visíveis sem ofuscar o conteúdo
- **AND** o card mantém a paleta escura própria do Board, independentemente do preset claro salvo

#### Scenario: Alteração de preset claro do shell
- **WHEN** o usuário troca entre os presets claros existentes
- **THEN** sidebar e cabeçalho global mudam conforme o preset
- **AND** a nuance do card acompanha o preset, enquanto canvas, colunas, barra de comandos, filtros e contexto permanecem consistentes
