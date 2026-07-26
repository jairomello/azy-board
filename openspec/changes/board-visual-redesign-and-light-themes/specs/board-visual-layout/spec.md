## ADDED Requirements

### Requirement: Shell estrutural do Board
O sistema SHALL renderizar o Board dentro de um shell composto por sidebar, header, command bar, conteúdo principal e status rail. Navegação e controles flutuantes SHALL ser visualmente distintos do conteúdo operacional sólido.

#### Scenario: Abrir o Board em desktop
- **WHEN** um usuário autenticado abre um projeto em viewport com pelo menos 1280px
- **THEN** o sistema exibe sidebar expandida, header, command bar e Board sem sobreposição
- **AND** projeto, visualização atual e ações principais ficam identificáveis sem depender apenas de cor

#### Scenario: Abrir o Board em viewport reduzido
- **WHEN** o viewport possui menos de 1024px
- **THEN** a sidebar fica disponível em drawer
- **AND** filtros secundários ficam em popover
- **AND** as colunas preservam largura estável com scroll horizontal

### Requirement: Navegação sem controles decorativos
O sistema SHALL renderizar na sidebar e no header apenas destinos, indicadores e ações com comportamento implementado.

#### Scenario: Capability ainda não implementada
- **WHEN** Timeline, Insights, presença ou notificações não possuem comportamento disponível
- **THEN** o sistema não exibe um controle clicável ou indicador fictício para essa capability

#### Scenario: Destinos existentes
- **WHEN** o usuário navega pelo shell
- **THEN** Projetos, Board/Árvore, Configurações do projeto e Conta permanecem acessíveis conforme suas permissões

### Requirement: Command bar funcional e compacta
O sistema SHALL oferecer troca Board/Árvore, filtros, densidade, ações auxiliares e criação dentro de uma command bar que não quebra em múltiplas linhas.

#### Scenario: Criar item pelo comando principal
- **WHEN** o usuário aciona **Criar**
- **THEN** o sistema exibe as opções Épico, História, Task e Bug permitidas para o usuário
- **AND** selecionar uma opção abre o fluxo de criação correspondente

#### Scenario: Aplicar filtros
- **WHEN** o usuário aplica um ou mais filtros
- **THEN** a command bar exibe a quantidade de filtros ativos
- **AND** oferece uma ação para limpar todos os filtros aplicados

#### Scenario: Usar busca quando disponível
- **WHEN** o campo de busca é renderizado
- **THEN** ele localiza itens carregados por ID ou título e permite abrir o resultado

### Requirement: Contexto operacional da sprint
O sistema SHALL exibir no Board apenas informações operacionais calculáveis a partir dos dados disponíveis.

#### Scenario: Projeto com sprint ativa
- **WHEN** o projeto possui uma sprint ativa
- **THEN** o cabeçalho mostra nome da sprint, itens concluídos, total e percentual de progresso

#### Scenario: Estado da sincronização
- **WHEN** a conexão WebSocket muda entre conectando, sincronizada e offline
- **THEN** o status rail comunica o estado atual em texto e ícone
- **AND** não depende somente de cor

### Requirement: Hierarquia visual do Board
O sistema SHALL diferenciar swimlanes, colunas e cards por estrutura, superfície, tipografia e espaçamento, preservando a densidade de uma ferramenta operacional.

#### Scenario: Exibir histórias como lanes
- **WHEN** `storyDisplay` está definido como `lanes`
- **THEN** o Board apresenta a hierarquia visual Épico → História → Cards
- **AND** épicos e histórias possuem accordions independentes
- **AND** cada história renderiza as colunas e cards pertencentes à sua ancestralidade

#### Scenario: Criar card na lane de história
- **WHEN** o usuário cria uma Task ou Bug pela ação contextual de uma coluna da história
- **THEN** o item é persistido com `parentId` igual ao ID da história
- **AND** aparece na mesma lane sem exigir nova associação manual

#### Scenario: Card do épico sem história
- **WHEN** um card possui épico ancestral, mas não história ancestral
- **THEN** o Board o renderiza no agrupamento `Sem história` dentro do épico

#### Scenario: Exibir histórias como cards
- **WHEN** `storyDisplay` está definido como `cards`
- **THEN** o Board preserva o comportamento anterior e renderiza histórias dentro das lanes de épico como cards

#### Scenario: Ocultar histórias vazias
- **WHEN** histórias são exibidas como lanes e o usuário ativa `hideEmptyStories`
- **THEN** lanes de histórias sem cards visíveis são omitidas

#### Scenario: Renderizar swimlane
- **WHEN** uma swimlane é exibida
- **THEN** seu cabeçalho apresenta título, contagem de itens e progresso quando calculável
- **AND** recolher ou expandir preserva o comportamento atual

#### Scenario: Renderizar coluna
- **WHEN** uma coluna é exibida
- **THEN** seu cabeçalho apresenta nome, contagem e limite de WIP quando configurado
- **AND** a área de adicionar card continua disponível

#### Scenario: Separar cabeçalho e cards da coluna
- **WHEN** uma coluna contém um ou mais cards
- **THEN** existe um espaçamento interno superior de 10px entre o cabeçalho e o primeiro card
- **AND** o espaçamento é consistente nas lanes de histórias e no modo de histórias como cards

#### Scenario: Renderizar card
- **WHEN** um card é exibido
- **THEN** tipo, ID, título, tags, prioridade, checklist, pontos e responsável disponíveis permanecem legíveis
- **AND** hover, drag e status não alteram as dimensões do card de forma a deslocar o layout

### Requirement: Acessibilidade do shell
O shell e o Board SHALL ser operáveis por teclado, apresentar foco visível e atingir contraste WCAG AA para textos e controles.

#### Scenario: Navegar sem mouse
- **WHEN** o usuário utiliza Tab, Shift+Tab, Enter, Espaço e setas nos controles apropriados
- **THEN** sidebar, command bar, menus, filtros e criação podem ser operados sem mouse

#### Scenario: Movimento reduzido
- **WHEN** o usuário possui `prefers-reduced-motion: reduce`
- **THEN** transições decorativas são removidas ou reduzidas
- **AND** feedback essencial de estado permanece perceptível
