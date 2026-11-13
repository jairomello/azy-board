# board-visual-presentation Specification

## Purpose

Define a composição visual da área de trabalho do Board para que o quadro real preserve a direção do protótipo e continue legível e funcional nos temas, modos e tamanhos de tela suportados.

## Requirements

### Requirement: Composição visual da área do Board
O Board SHALL apresentar barra de comandos, filtros ativos, contexto/progresso e canvas como uma área de trabalho coesa, com hierarquia, espaçamento, superfícies e bordas alinhados ao protótipo `docs/prototipos/kanban-reformulado/`. A navegação global do shell SHALL manter seu contrato atual.

#### Scenario: Board em modo Kanban
- **WHEN** o usuário abre o quadro na visualização Kanban
- **THEN** barra de comandos, filtros ativos e contexto antecedem um canvas contínuo com colunas alinhadas, contadores de itens e ações de criação, seguindo a composição do protótipo

#### Scenario: Board em modo árvore
- **WHEN** o usuário alterna para a visualização em árvore
- **THEN** comandos, filtros, tema e contexto permanecem acessíveis e o conteúdo em árvore conserva sua apresentação funcional dentro da mesma área de trabalho

#### Scenario: Shell global preservado
- **WHEN** o usuário navega entre Board e outras telas
- **THEN** a reformulação do Board não altera navegação, sidebar, cabeçalho global, perfil ou controles globais do AppShell

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

### Requirement: Colunas do Kanban adaptáveis
As colunas SHALL manter a largura de referência de 292 px em telas largas, com cabeçalho, estado de destino de arraste, lista de cards e controle de criação legíveis e distinguíveis nos dois temas.

#### Scenario: Quadro largo
- **WHEN** há espaço horizontal suficiente para múltiplas colunas
- **THEN** as colunas mantêm largura uniforme de 292 px, rolagem horizontal do canvas e espaçamento visual consistente

#### Scenario: Coluna como destino de arraste
- **WHEN** um card arrastável está sobre uma coluna elegível
- **THEN** a coluna comunica o estado de destino com destaque coerente com a paleta ativa e preserva o conteúdo legível

#### Scenario: Janela estreita
- **WHEN** o Board é exibido em viewport estreito
- **THEN** os controles podem quebrar ou rolar conforme o layout existente e o canvas mantém acesso às colunas sem comprimir os cards a ponto de prejudicar sua leitura

### Requirement: Estados visuais consistentes no quadro
Cards, colunas, filtros e controles SHALL apresentar estados de foco, hover, seleção, arraste, desabilitado e vazio com tokens consistentes, foco visível e contraste suficiente nos temas suportados.

#### Scenario: Navegação por teclado
- **WHEN** o usuário percorre comandos, filtros, colunas, cards e ações usando teclado
- **THEN** cada controle focável apresenta indicador de foco visível sem depender apenas de cor ou movimento

#### Scenario: Quadro sem cards
- **WHEN** uma coluna não possui cards
- **THEN** a coluna mantém sua estrutura e oferece o controle de criação sem parecer um estado quebrado ou indistinguível do canvas

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
