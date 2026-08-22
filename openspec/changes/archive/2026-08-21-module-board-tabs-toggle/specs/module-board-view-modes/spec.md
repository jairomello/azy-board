## ADDED Requirements

### Requirement: Modos de apresentação dos módulos

O Board SHALL oferecer dois modos mutuamente exclusivos de apresentação dos módulos: `Hierarquia`, que exibe todos os módulos agrupados verticalmente, e `Abas`, que exibe um único módulo por vez dentro de uma guia selecionada.

#### Scenario: Modo hierarquia padrão

- **WHEN** o usuário abre um projeto sem preferência de modo salva
- **THEN** o Board exibe os módulos em hierarquia e todas as swimlanes de módulos elegíveis ficam visíveis

#### Scenario: Alternar para abas

- **WHEN** o usuário seleciona `Abas` no controle de visualização do Board
- **THEN** o Board exibe uma guia para cada módulo com conteúdo e renderiza apenas o módulo ativo

#### Scenario: Voltar para hierarquia

- **WHEN** o usuário seleciona `Hierarquia`
- **THEN** o Board volta a exibir todos os módulos na composição hierárquica existente

### Requirement: Navegação entre abas de módulo

No modo `Abas`, o sistema SHALL permitir selecionar qualquer módulo com conteúdo sem recarregar a página ou buscar novamente os cards.

#### Scenario: Troca de módulo ativo

- **WHEN** o usuário clica em uma aba de módulo
- **THEN** a aba fica selecionada e o conteúdo exibido muda para as swimlanes daquele módulo

#### Scenario: Módulo sem módulo

- **WHEN** existem épicos elegíveis sem `moduleId`
- **THEN** o sistema exibe uma aba traduzida `Sem módulo` para o grupo virtual correspondente

### Requirement: Consistência dos recursos do board

Os dois modos SHALL reutilizar filtros, drag-and-drop, colapso de módulo/épico/história, criação e edição de itens e renderização de colunas sem alterar suas regras de negócio.

#### Scenario: Filtro aplicado em abas

- **WHEN** o usuário aplica um filtro de sprint, responsável, squad, tag ou tipo no modo `Abas`
- **THEN** os cards da aba ativa respeitam o filtro da mesma forma que no modo `Hierarquia`

#### Scenario: Estado de colapso preservado

- **WHEN** o usuário alterna entre os modos
- **THEN** os estados de colapso já registrados para módulos, épicos e histórias não são descartados
