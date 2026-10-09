## Purpose

Definir a estrutura visual do card do Kanban (`KanbanCard`) conforme a proposta **01 — Essencial**, ordenando as regiões do card e as regras de exibição de cada uma.
## Requirements
### Requirement: Estrutura de regiões do card do Kanban
O sistema SHALL renderizar o card na composição de `docs/prototipos/kanban-reformulado/`, dentro da coluna de 292 px, com raiz, topo, breadcrumb, título, tags/tipo, progresso opcional e rodapé nessa ordem. A raiz SHALL usar superfície temática, borda suave multicolorida, cantos de 13 px, elevação discreta e faixa lateral de 3 px representando o status. Realces e brilhos SHALL permanecer sutis em quadros densos.

#### Scenario: Card renderiza as regiões na ordem definida
- **WHEN** uma tarefa ou bug é exibido no Kanban
- **THEN** as regiões aparecem na ordem topo, breadcrumb, título, tags/tipo, progresso quando houver e rodapé, sem sobreposição

#### Scenario: Faixa lateral representa o status
- **WHEN** o status do card muda
- **THEN** a faixa lateral acompanha o status e não é alterada pelo tipo ou pela cor do ícone

#### Scenario: Elevação sem competir com o conteúdo
- **WHEN** muitos cards estão visíveis na mesma coluna
- **THEN** o brilho, gradiente, borda e sombra permanecem discretos e não reduzem a legibilidade nem escondem o estado do card

### Requirement: Linha de topo do card
O sistema SHALL organizar o topo como no protótipo: alça de arraste separada do conteúdo, ícone e código curto à esquerda e ações no canto superior direito. Quando dados opcionais estiverem ausentes, o sistema SHALL manter o alinhamento sem inventar conteúdo nem exibir UUID truncado.

#### Scenario: Card com ícone e código
- **WHEN** o card possui ícone, cor e `sequenceCode`
- **THEN** o topo exibe alça, ícone colorido e código curto sem UUID

#### Scenario: Card sem ícone e sem código
- **WHEN** um ou ambos os campos opcionais estão ausentes
- **THEN** somente os dados existentes são exibidos e as ações não cobrem o conteúdo

### Requirement: Título em destaque com truncamento
O sistema SHALL exibir o título em destaque com até duas linhas no modo confortável e uma linha no modo compacto. Títulos longos SHALL truncar dentro da largura disponível sem invadir outras regiões; clique para detalhe e edição inline SHALL continuar funcionando.

#### Scenario: Título longo truncado em duas linhas
- **WHEN** o título excede duas linhas na coluna de referência
- **THEN** ele é truncado na segunda linha sem deslocar ou cobrir as outras regiões

#### Scenario: Título longo truncado em uma linha
- **WHEN** o título excede uma linha no modo compacto
- **THEN** ele é truncado e seu texto integral continua acessível por tooltip

#### Scenario: Interações do título preservadas
- **WHEN** o usuário abre detalhes ou inicia edição inline pelo título
- **THEN** cada ação mantém o comportamento atual sem disparar a outra por propagação

### Requirement: Linha de etiquetas com tipo textual único
O sistema SHALL exibir tags à esquerda e uma única etiqueta textual do tipo à direita, usando cores legíveis nos temas claro e escuro. Tags múltiplas SHALL poder quebrar linha sem sobreposição.

#### Scenario: Tags à esquerda e tipo à direita
- **WHEN** o card possui tags e tipo
- **THEN** as tags ficam à esquerda e o tipo aparece uma única vez à direita

#### Scenario: Tags múltiplas quebram linha
- **WHEN** as tags não cabem em uma linha
- **THEN** elas quebram linha e o card aumenta de altura sem cobrir outras regiões

### Requirement: Região de progresso de checklist entre etiquetas e rodapé
O sistema SHALL exibir o progresso da checklist entre tags/tipo e rodapé somente quando houver pelo menos um item, mantendo rótulos e indicador legíveis nos dois temas.

#### Scenario: Card com checklists
- **WHEN** existe pelo menos um item de checklist
- **THEN** o progresso aparece entre tags/tipo e rodapé

#### Scenario: Card sem checklists
- **WHEN** não existe item de checklist
- **THEN** a região de progresso é omitida e não deixa espaço vazio

### Requirement: Rodapé com divisor e campos condicionais
O sistema SHALL separar o rodapé por divisor sutil e alinhar os metadados existentes na ordem prioridade, pontos, contagem de filhos e avatar do responsável ao fim. Campos ausentes SHALL ser omitidos sem reserva de espaço.

#### Scenario: Card com todos os metadados
- **WHEN** o card possui prioridade, pontos, filhos e responsável
- **THEN** esses dados aparecem no rodapé na ordem definida, com avatar alinhado ao fim

#### Scenario: Card sem metadados opcionais
- **WHEN** um ou mais metadados não existem
- **THEN** somente os disponíveis são exibidos sem lacunas reservadas

### Requirement: Ações do card no hover e no foco
O sistema SHALL revelar copiar referência, arquivar e excluir no hover e no foco por teclado, na área do topo à direita e sem cobrir o conteúdo. Permissões, confirmação de exclusão, nomes acessíveis e foco visível SHALL ser preservados. Ações SHALL NOT abrir detalhes nem iniciar arraste.

#### Scenario: Ações visíveis no hover e no foco
- **WHEN** o card recebe hover ou foco dentro
- **THEN** as ações permitidas são reveladas sem sobrepor ícone, código, breadcrumb, título ou tags

#### Scenario: Ações não propagam para o card
- **WHEN** o usuário aciona copiar, arquivar ou excluir
- **THEN** a ação correspondente ocorre sem abrir detalhes ou iniciar arraste, e exclusão solicita confirmação

#### Scenario: Permissões preservadas
- **WHEN** o usuário não pode arquivar ou excluir
- **THEN** essas ações não são exibidas e copiar permanece disponível conforme a leitura permitida

### Requirement: Compatibilidade de temas, densidade e modos de board
O sistema SHALL aplicar o visual do protótipo nos temas efetivos claro e escuro, nas densidades confortável e compacta e nos modos SIMPLE e HIERARCHICAL, preservando os dados e interações do card.

#### Scenario: Tema escuro
- **WHEN** o usuário alterna o tema efetivo
- **THEN** superfície, borda, brilho, divisor, etiquetas e ações mudam para cores legíveis do tema ativo

#### Scenario: Densidade compacta
- **WHEN** o Board está em modo compacto
- **THEN** o card reduz espaços e aplica o título em uma linha e breadcrumb oculto sem colisões

#### Scenario: Modos SIMPLE e HIERARCHICAL
- **WHEN** qualquer modo de board está ativo
- **THEN** os cards exibem os dados aplicáveis àquele modo sem alterar a hierarquia de conteúdo definida

### Requirement: Indicador de dependências no card

O card do Kanban SHALL exibir um indicador compacto composto por ícone e contagem numérica quando o item depender de um ou mais itens, refletindo a quantidade de dependências diretas (`dependencyCount`). O indicador SHALL ser omitido quando a contagem for zero, SHALL permanecer visível para usuários somente leitura e SHALL NOT alterar nem cobrir as demais regiões do card.

#### Scenario: Card com dependências
- **WHEN** um card possui uma ou mais dependências cadastradas
- **THEN** o card exibe um ícone acompanhado do número de dependências, sem deslocar as demais regiões

#### Scenario: Card sem dependências
- **WHEN** um card não possui dependências cadastradas
- **THEN** o indicador é omitido e não reserva espaço vazio

#### Scenario: Indicador visível para somente leitura
- **WHEN** um usuário com papel VIEWER visualiza o board
- **THEN** o indicador de dependências aparece nos cards que tiverem dependências, sem permitir edição por esse meio

#### Scenario: Indicador acessível
- **WHEN** o indicador de dependências é exibido
- **THEN** ele possui nome acessível descrevendo a contagem, legível por leitor de tela
