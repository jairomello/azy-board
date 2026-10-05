## Purpose

Definir a estrutura visual do card do Kanban (`KanbanCard`) conforme a proposta **01 — Essencial**, ordenando as regiões do card e as regras de exibição de cada uma.
## Requirements
### Requirement: Estrutura de regiões do card do Kanban
O sistema SHALL renderizar o `KanbanCard` na hierarquia visual da proposta **01 — Essencial** (`docs/prototipos/cards-t32/01-essencial.svg`), dentro da coluna de 292 px, composto pelas regiões, nesta ordem: raiz, linha de topo, breadcrumb, título, etiquetas, progresso de checklist (opcional) e rodapé. A raiz SHALL usar superfície com o token `--card`, borda discreta com o token `--border`, cantos arredondados de 10 px e faixa lateral de 3 px na cor do **status** do card (não do tipo nem da cor personalizada do ícone).

#### Scenario: Card renderiza as regiões na ordem definida
- **WHEN** um card de tarefa ou bug é exibido no board
- **THEN** as regiões aparecem na ordem topo, breadcrumb, título, etiquetas, progresso (quando houver) e rodapé, sem sobreposição entre elas

#### Scenario: Faixa lateral representa o status
- **WHEN** o card muda de status (ex: `NOT_STARTED` para `IN_PROGRESS`)
- **THEN** a cor da faixa lateral de 3 px reflete o novo status e não é alterada pelo tipo do item nem pela cor personalizada do ícone

### Requirement: Linha de topo do card
O sistema SHALL organizar a linha de topo da esquerda para a direita como: alça de arraste, ícone do item (figura e cor configuradas no card, com 23 px) e código curto (`sequenceCode`, como `T32` ou `B2`), reservando no canto superior direito uma área de aproximadamente 84 px para as ações. Quando o item não possuir ícone ou código, o sistema SHALL manter o alinhamento sem inventar conteúdo.

#### Scenario: Card com ícone e código
- **WHEN** um card possui `icon`, `color` e `sequenceCode` configurados
- **THEN** o topo exibe a alça, o ícone com a cor configurada e o código curto, sem exibir UUID truncado

#### Scenario: Card sem ícone e sem código
- **WHEN** um card não possui ícone nem `sequenceCode`
- **THEN** o topo exibe apenas a alça e a área reservada às ações, sem UUID truncado ou marcador substituto

### Requirement: Título em destaque com truncamento
O sistema SHALL exibir o título do card com maior ênfase tipográfica (peso semibold) e até duas linhas na visualização padrão. Títulos longos SHALL truncar sem invadir as demais regiões, e a edição inline e o clique para abrir os detalhes SHALL continuar funcionando.

#### Scenario: Título longo truncado em duas linhas
- **WHEN** um card possui título que excede duas linhas na coluna de 292 px
- **THEN** o título é truncado na segunda linha sem empurrar o breadcrumb, as etiquetas ou o rodapé

#### Scenario: Interações do título preservadas
- **WHEN** o usuário clica no título para abrir detalhes ou aciona a edição inline
- **THEN** o comportamento atual é mantido sem abrir o modal por propagação indesejada

### Requirement: Linha de etiquetas com tipo textual único
O sistema SHALL exibir na linha seguinte ao título as tags do item à esquerda e uma única etiqueta textual de tipo (Tarefa, Bug, etc.) à direita. Tags múltiplas SHALL poder quebrar linha e aumentar a altura do card sem sobreposição. O tipo SHALL aparecer uma única vez no card, por texto e cor.

#### Scenario: Tags à esquerda e tipo à direita
- **WHEN** um card possui tags e tipo definidos
- **THEN** as tags são exibidas como chips à esquerda da linha e a etiqueta de tipo aparece uma única vez à direita, sem duplicação no rodapé

#### Scenario: Tags múltiplas quebram linha
- **WHEN** um card possui tags cuja largura somada excede a linha
- **THEN** as tags quebram para a linha seguinte, o card cresce em altura e nenhuma região é sobreposta

### Requirement: Região de progresso de checklist entre etiquetas e rodapé
O sistema SHALL exibir a região de progresso de checklists entre a linha de etiquetas e o rodapé, somente quando houver ao menos um item de checklist.

#### Scenario: Card com checklists
- **WHEN** um card com checklists é exibido no board
- **THEN** o progresso aparece entre as etiquetas e o rodapé, sem ocupar espaço no rodapé

#### Scenario: Card sem checklists
- **WHEN** um card não possui checklists
- **THEN** nenhuma região de progresso é renderizada e o rodapé sucede diretamente as etiquetas

### Requirement: Rodapé com divisor e campos condicionais
O sistema SHALL separar o rodapé por um divisor sutil e alinhar, quando presentes, na ordem: prioridade, pontos, indicador e contagem de subtarefas e avatar do responsável (alinhado ao fim). Metadados ausentes SHALL ser omitidos sem reservar espaço.

#### Scenario: Card com todos os metadados
- **WHEN** um card possui prioridade, pontos, subtarefas e responsável
- **THEN** o rodapé exibe, após o divisor, prioridade, pontos e contagem de subtarefas à esquerda e o avatar do responsável à direita

#### Scenario: Card sem metadados opcionais
- **WHEN** um card não possui pontos, subtarefas ou responsável
- **THEN** o rodapé exibe apenas os campos existentes, sem espaços vazios reservados

### Requirement: Ações do card no hover e no foco
O sistema SHALL exibir, no hover e no foco por teclado, as ações copiar referência, arquivar e excluir — nessa ordem — na área reservada do topo direito, sem cobrir ícone, código, breadcrumb, título ou tags. O sistema SHALL preservar as permissões e o comportamento atuais das ações (copiar disponível conforme a leitura permitida; arquivar/excluir apenas para quem pode executá-los; exclusão com confirmação). Cliques nas ações SHALL NOT abrir o card nem iniciar o arraste. Os botões SHALL ter nomes acessíveis e foco visível.

#### Scenario: Ações visíveis no hover e no foco
- **WHEN** o usuário passa o mouse sobre o card ou navega por teclado até as ações
- **THEN** os três botões aparecem na área reservada do topo direito, na ordem copiar, arquivar, excluir, sem sobrepor o conteúdo do card

#### Scenario: Ações não propagam para o card
- **WHEN** o usuário clica em copiar, arquivar ou excluir
- **THEN** o modal do card não abre, o arraste não inicia e a exclusão pede confirmação antes de executar

#### Scenario: Permissões preservadas
- **WHEN** um usuário sem permissão de arquivar/excluir visualiza o card
- **THEN** as ações correspondentes não são exibidas, e copiar permanece disponível conforme a leitura permitida

### Requirement: Compatibilidade de temas, densidade e modos de board
O sistema SHALL apresentar o novo layout nos temas claro e escuro, na densidade compacta e nos modos de board SIMPLE e HIERARCHICAL.

#### Scenario: Tema escuro
- **WHEN** o board é exibido no tema escuro
- **THEN** superfície, borda, divisor, etiquetas e ações usam os tokens do tema e permanecem legíveis

#### Scenario: Densidade compacta
- **WHEN** o board está em densidade compacta
- **THEN** o card mantém a hierarquia de regiões com o espaçamento reduzido, sem colisões
