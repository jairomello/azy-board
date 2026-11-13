# Spec Delta

## ADDED Requirements

### Requirement: Acabamento das superfícies do Board no modo escuro
No modo escuro, as superfícies do Board SHALL receber acabamento derivado do preset ativo: halo radial no canvas, degradê tonificado em colunas e cabeçalhos, gradiente sutil nos cards, contorno luminoso, sombra profunda e realce mais intenso em hover e foco. O acabamento SHALL ser contido a ponto de não comprometer a leitura do conteúdo nem a distinção entre superfícies.

#### Scenario: Cards com contorno luminoso
- **WHEN** o Board é exibido no modo escuro
- **THEN** cada card apresenta gradiente sutil, contorno com brilho suave e sombra profunda coerentes com o preset ativo
- **AND** o texto, o código do item e as etiquetas permanecem legíveis

#### Scenario: Hover e foco realçam sem ofuscar
- **WHEN** o usuário passa o mouse sobre um card ou o foca pelo teclado no modo escuro
- **THEN** sombra e brilho do contorno aumentam de forma discreta
- **AND** o estado de foco continua visível e distinguível do hover

#### Scenario: Superfícies distinguíveis
- **WHEN** o Board é exibido no modo escuro
- **THEN** canvas, barra de comandos, contexto, colunas e cards são distinguíveis entre si por tom, borda ou sombra
- **AND** nenhuma superfície usa preto puro como fundo das áreas de trabalho

#### Scenario: Movimento reduzido
- **WHEN** o usuário tem `prefers-reduced-motion` ativo
- **THEN** o acabamento visual permanece estático, sem animação contínua de brilho

## MODIFIED Requirements

### Requirement: Paleta do Board nos temas claro e escuro
O Board SHALL aplicar superfícies, bordas, realces e sombras inspirados nos SVGs claro e escuro de referência por meio de tokens compatíveis com o tema efetivo, mantendo contraste de texto e controles. No modo claro, a nuance de fundo, a borda e o realce sutil do **card** SHALL acompanhar o preset de shell claro escolhido. As demais superfícies do Board (canvas, colunas, barra de comandos, filtros e contexto) SHALL permanecer independentes dos presets. No modo escuro, todas as superfícies do Board SHALL acompanhar a variante escura do preset de shell ativo, preservando a distinção entre canvas, colunas e cards.

#### Scenario: Card no tema claro acompanha o preset do shell
- **WHEN** o tema efetivo é claro e o usuário troca o preset de shell claro
- **THEN** a nuance de fundo, a borda e o realce do card passam a refletir a cor do preset escolhido, sem reload

#### Scenario: Board no tema claro
- **WHEN** o tema efetivo da aplicação é claro
- **THEN** canvas, colunas, filtros e estados de interação apresentam a paleta clara do protótipo, com brilho e contornos discretos que não competem com os cards
- **AND** a nuance do card acompanha o preset claro ativo

#### Scenario: Board no tema escuro
- **WHEN** o tema efetivo da aplicação é escuro
- **THEN** canvas, colunas, cabeçalhos e cards apresentam a variante escura do preset ativo, com contornos e realces visíveis sem ofuscar o conteúdo
- **AND** o card deixa de usar uma paleta escura fixa e acompanha o preset

#### Scenario: Alteração de preset claro do shell
- **WHEN** o usuário troca entre os presets existentes
- **THEN** sidebar e cabeçalho global mudam conforme o preset
- **AND** a nuance do card acompanha o preset, enquanto canvas, colunas, barra de comandos, filtros e contexto permanecem consistentes no modo claro

#### Scenario: Alteração de preset no modo escuro
- **WHEN** o usuário troca de preset com o tema escuro ativo
- **THEN** canvas, barra de comandos, contexto, colunas, cabeçalhos e cards passam para a variante escura do novo preset sem reload
- **AND** a hierarquia visual e a legibilidade se mantêm

#### Scenario: Barra de progresso do Board
- **WHEN** o Board exibe progresso no modo escuro
- **THEN** o preenchimento da barra usa o gradiente do preset ativo
- **AND** os indicadores de status preservam o significado das cores
