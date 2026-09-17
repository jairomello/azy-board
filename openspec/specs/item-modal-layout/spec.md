# item-modal-layout Specification

## Purpose
TBD - created by archiving change fix-item-modal-height. Update Purpose after archive.
## Requirements
### Requirement: Altura fixa das modais de item
As modais de item de Task, Bug, Subtask, Épico e História SHALL abrir com altura fixa de 80% da altura disponível na viewport e SHALL manter essa altura durante toda a interação, independentemente do conteúdo da aba ativa ou da quantidade de dados.

#### Scenario: Abrir a modal
- **WHEN** usuário abre uma modal de Task, Bug, Subtask, Épico ou História
- **THEN** o diálogo ocupa 80% da altura disponível na viewport desde a primeira renderização

#### Scenario: Alternar áreas não redimensiona
- **WHEN** usuário alterna entre Detalhes, lista de filhos e Histórico
- **THEN** a altura da modal permanece exatamente a mesma, sem salto de layout

#### Scenario: Conteúdo curto
- **WHEN** a aba ativa tem pouco conteúdo
- **THEN** a modal mantém a altura fixa e o espaço excedente fica no miolo, sem encolher a janela

#### Scenario: Conteúdo longo
- **WHEN** o conteúdo da aba excede a altura fixa
- **THEN** somente o miolo ganha barra de rolagem vertical e a altura da modal continua inalterada

#### Scenario: Modais filhas empilhadas
- **WHEN** usuário abre uma subtask a partir de uma task ou um filho a partir de épico/história
- **THEN** a nova modal também abre com a mesma altura fixa

### Requirement: Cabeçalho, navegação e ações persistentes
O cabeçalho, a navegação de áreas e o rodapé de ações SHALL permanecer visíveis e fixos, e somente a área de conteúdo SHALL rolar.

#### Scenario: Rolar o conteúdo
- **WHEN** usuário rola o conteúdo de uma aba
- **THEN** o cabeçalho, a navegação de áreas e o rodapé com Salvar/Cancelar permanecem no lugar

#### Scenario: Ações sempre acessíveis
- **WHEN** a aba ativa tem conteúdo longo
- **THEN** usuário consegue acionar Salvar e Cancelar sem precisar rolar até o fim do conteúdo

### Requirement: Escopo, unidades e responsividade da altura
A altura fixa SHALL usar unidade de viewport dinâmica com fallback estável, NÃO SHALL introduzir rolagem horizontal e NÃO SHALL alterar largura máxima, composição de colunas, campos, payloads ou acessibilidade das modais.

#### Scenario: Viewport móvel
- **WHEN** a modal é aberta em viewport móvel, inclusive com barras de navegador ou teclado virtual
- **THEN** a altura acompanha a viewport dinâmica e o conteúdo continua acessível por rolagem vertical, sem rolagem horizontal

#### Scenario: Comportamento funcional preservado
- **WHEN** usuário edita campos, alterna áreas, abre a lista de filhos ou salva
- **THEN** payloads, validações, navegação por teclado, `role="dialog"`, `aria-modal` e o stack de modais permanecem iguais

#### Scenario: Modais fora do escopo
- **WHEN** usuário abre a modal de versão, o editor rich text expandido, confirmações ou telas de settings
- **THEN** a altura dessas modais não é alterada por este requisito

