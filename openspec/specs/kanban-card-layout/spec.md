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

### Requirement: Alça de arraste ampliada no card
O card do Kanban SHALL apresentar a alça de arraste como uma faixa vertical na lateral esquerda, com a altura total do card e largura ampliada de aproximadamente 30 px, sinalizada por uma seta de quatro pontas. A alça SHALL NOT invadir nem cobrir as demais regiões do card e SHALL continuar sendo o único ponto que inicia o arraste.

#### Scenario: Alvo de arraste ampliado
- **WHEN** o board exibe um card arrastável
- **THEN** a alça ocupa a lateral esquerda com a altura do card e largura de aproximadamente 30 px, sem cobrir topo, breadcrumb, título, etiquetas, progresso, rodapé ou ações

#### Scenario: Símbolo de quatro pontas
- **WHEN** o ponteiro está sobre um card arrastável
- **THEN** a alça mostra uma seta de quatro pontas apontando nas quatro direções, no lugar dos pontos anteriores

#### Scenario: Alça como única origem do arraste
- **WHEN** o usuário interage com um card arrastável
- **THEN** o arraste começa somente a partir da alça, e o restante do card mantém abrir detalhe, edição inline do título e ações do topo

#### Scenario: Card não arrastável
- **WHEN** o card é um EPIC ou uma TASK/BUG com filhos
- **THEN** a alça permanece visível na largura ampliada sem iniciar arraste, com cursor de indisponível e sem o símbolo de mover

### Requirement: Visibilidade e destaque da seta de arraste
Em cards arrastáveis, a seta SHALL ficar oculta enquanto o ponteiro estiver fora do card, SHALL aparecer quando o ponteiro estiver sobre qualquer ponto do card e SHALL receber destaque forte, com cor e fundo próprios, quando o ponteiro estiver sobre a alça. O foco por teclado SHALL revelar a seta com o mesmo destaque forte.

#### Scenario: Visibilidade progressiva com o ponteiro
- **WHEN** o ponteiro entra no card e depois na alça
- **THEN** a seta aparece ao entrar no card e assume o destaque forte ao entrar na alça

#### Scenario: Seta oculta em repouso
- **WHEN** o ponteiro está fora do card e nada dentro dele está em foco
- **THEN** a alça não mostra a seta, nos temas claro e escuro

#### Scenario: Foco por teclado revela a seta
- **WHEN** a alça recebe foco por teclado
- **THEN** a seta aparece com o mesmo destaque forte do ponteiro, com foco visível e nome acessível traduzido

#### Scenario: Dispositivo sem hover
- **WHEN** o board é usado em um dispositivo sem hover, como toque
- **THEN** a seta permanece visível e discreta, já que o estado de ponteiro sobre o card não acontece

#### Scenario: Destaque não afeta as demais regiões
- **WHEN** a alça está no destaque forte
- **THEN** ações do topo, título, etiquetas e rodapé permanecem legíveis e inalterados

#### Scenario: Densidade compacta e modos de board
- **WHEN** o board está na densidade compacta ou no modo HIERARCHICAL
- **THEN** a alça mantém largura, símbolo e destaques sem colidir com o conteúdo

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

### Requirement: Região de avanço entre etiquetas e rodapé

O sistema SHALL exibir entre tags/tipo e rodapé uma região de progresso composta por até três barras, nesta ordem: progresso do card, progresso do checklist e avanço das subtasks. A barra principal SHALL aparecer sempre que o avanço for maior que zero, com rótulo acessível de avanço no fluxo e indicador legível nos dois temas; ela SHALL usar trilho com cantos arredondados, preenchimento em gradiente derivado dos tokens do tema e marcas discretas de referência. As barras de checklist e de subtasks SHALL seguir os requisitos próprios e usar estilos e cores distintos entre si e da barra principal. A região SHALL ser omitida apenas quando as três barras estiverem ausentes. O preenchimento SHALL transicionar de largura ao aparecer ou mudar de valor, exceto quando `prefers-reduced-motion` estiver ativa. Ao atingir 100%, a barra principal SHALL usar o token de concluído.

#### Scenario: Card com checklists

- **WHEN** existe pelo menos um item de checklist
- **THEN** a barra de checklist e o contador `marcados/total` aparecem entre tags/tipo e rodapé, junto da barra principal quando houver avanço

#### Scenario: Card sem checklists

- **WHEN** não existe item de checklist e o card está em uma coluna cujo peso de avanço é 90
- **THEN** a região exibe a barra principal em 90%, sem contador de checklist

#### Scenario: Card sem avanço

- **WHEN** o card não tem avanço, checklist com itens nem filhos
- **THEN** a região de avanço é omitida e não deixa espaço vazio

#### Scenario: Barra no tema escuro

- **WHEN** o tema escuro está ativo
- **THEN** trilhos, preenchimentos e marcas das três barras permanecem distinguíveis e com contraste legível

#### Scenario: Movimento reduzido

- **WHEN** o usuário tem `prefers-reduced-motion: reduce`
- **THEN** as barras aparecem preenchidas sem transição de largura nem brilho animado

#### Scenario: Card com as três barras

- **WHEN** o card tem avanço maior que zero, checklist com itens e subtasks
- **THEN** a região exibe, nesta ordem, a barra principal, a barra de checklist e a barra de subtasks, sem sobreposição

#### Scenario: Card com checklist e sem subtasks

- **WHEN** o card tem checklist com itens e nenhum filho
- **THEN** a região exibe a barra principal quando houver avanço e a barra de checklist, sem reservar espaço para a barra de subtasks

#### Scenario: Card com subtasks e sem checklist

- **WHEN** o card tem filhos e nenhum checklist
- **THEN** a região exibe a barra principal quando houver avanço e a barra de subtasks, sem contador de checklist

#### Scenario: Card com checklist e avanço zero

- **WHEN** o card está em coluna de peso 0, mas tem checklist com itens
- **THEN** a barra principal é omitida e a barra de checklist permanece visível

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

### Requirement: Faixa de etiquetas com truncamento e resumo

O sistema SHALL exibir as tags do card em uma faixa própria, em uma única linha,
com altura fixa e sem quebra de texto dentro da pílula. Cada tag SHALL ter largura
máxima e truncar com reticências, expondo o nome completo em tooltip. Quando as
tags não couberem, o sistema SHALL exibir até duas tags e resumir as restantes em
um chip `+N` com tooltip e nome acessível. Card sem tags SHALL omitir a faixa.

#### Scenario: Tags curtas em uma linha

- **WHEN** o card tem duas tags curtas
- **THEN** as duas aparecem na faixa de tags, com altura constante e sem quebrar o texto

#### Scenario: Tag longa truncada

- **WHEN** uma tag tem nome maior que a largura máxima definida
- **THEN** o nome é truncado com reticências, permanece em uma linha e o nome completo aparece no tooltip

#### Scenario: Muitas tags com resumo

- **WHEN** o card tem mais tags do que o espaço permite
- **THEN** no máximo duas tags aparecem e as restantes são resumidas em `+N`, com a lista completa no tooltip e nome acessível

#### Scenario: Card sem tags

- **WHEN** o card não tem tags
- **THEN** a faixa de tags é omitida e não reserva espaço vazio

#### Scenario: Tema escuro e densidade compacta

- **WHEN** o tema escuro ou a densidade compacta está ativa
- **THEN** as tags e o chip `+N` mantêm contraste e alinhamento, sem quebra de texto

### Requirement: Faixa de status e tipo separada das tags

O sistema SHALL exibir status e tipo em uma faixa própria, separada das tags, sem
quebra de linha e com a mesma altura das tags. A etiqueta de status SHALL manter
o nome do status no idioma da interface e o destaque de alerta quando o status
não combina com a coluna. A faixa SHALL permanecer alinhada mesmo quando existir
tag longa ou muitas tags.

#### Scenario: Status e tipo fora da faixa de tags

- **WHEN** o card tem tags, status e tipo
- **THEN** as tags ocupam uma faixa e o status e o tipo ocupam outra, sem competir por largura nem desalinhar

#### Scenario: Card sem tags

- **WHEN** o card não tem tags
- **THEN** status e tipo ocupam a faixa sem lacuna reservada para tags

#### Scenario: Status visível no card

- **WHEN** um card com status `IN_PROGRESS` está na coluna "Fazendo", de status base `IN_PROGRESS`
- **THEN** o card mostra a etiqueta "Em andamento" ao lado do tipo, sem destaque de alerta

#### Scenario: Status diferente da coluna

- **WHEN** um card com status `IN_HOMOLOGATION` está na coluna Backlog e o projeto tem a coluna "Em Homologação"
- **THEN** a etiqueta "Em homologação" aparece em destaque de alerta, com a dica "Status diferente da coluna "Backlog""

#### Scenario: Status sem coluna própria não é desencontro

- **WHEN** um card `BLOCKED` está em "A Fazer" e o projeto não tem coluna de status base `BLOCKED`
- **THEN** a etiqueta "Bloqueada" aparece sem destaque de alerta

#### Scenario: Mesma etiqueta no Kanban unificado

- **WHEN** o usuário alterna entre o Board e o Kanban unificado
- **THEN** cada card mostra a mesma etiqueta de status e o mesmo destaque nas duas visões

### Requirement: Barra de progresso do checklist no card

O card SHALL exibir uma barra de checklist apenas quando o item tiver ao menos um checklist com itens. A barra SHALL representar a razão entre marcados e total, agregando todos os checklists, ao lado do contador `marcados/total` existente. A barra SHALL usar cor, estilo e nome acessível próprios, distintos das demais barras, e SHALL manter a identidade de checklist em 100%.

#### Scenario: Card com vários checklists

- **WHEN** o card tem dois checklists, com 4 de 6 e 8 de 14 itens marcados
- **THEN** a barra de checklist mostra 12 de 20 e 60%, e o contador exibe `12/20`

#### Scenario: Checklist sem itens

- **WHEN** o card tem um checklist criado, mas sem nenhum item
- **THEN** a barra de checklist não é exibida

#### Scenario: Checklist concluído

- **WHEN** todos os itens de todos os checklists do card estão marcados
- **THEN** a barra de checklist aparece cheia, com o ícone de checklist concluído, e a barra principal continua refletindo apenas status e coluna

#### Scenario: Cor distinta da barra principal

- **WHEN** as barras principal e de checklist aparecem juntas no mesmo card
- **THEN** cada uma usa sua própria família de cor e estilo, sem ambiguidade entre os dois indicadores

#### Scenario: Nome acessível do checklist

- **WHEN** um leitor de tela percorre o card
- **THEN** a barra de checklist anuncia o progresso de checklist com marcados, total e percentual, em nome distinto da barra principal

### Requirement: Barra de progresso das subtasks no card

O card SHALL exibir uma barra de subtasks apenas quando o item tiver filhos diretos não cancelados e não arquivados. A barra SHALL representar a média do avanço das subtasks diretas, calculada pela mesma regra de status e coluna da barra principal, sem considerar checklist. A barra SHALL usar estilo, cor e nome acessível próprios e SHALL exibir a quantidade de subtasks consideradas junto do percentual.

#### Scenario: Card com subtasks em andamento

- **WHEN** o card tem quatro subtasks com avanços 100%, 100%, 50% e 0%
- **THEN** a barra de subtasks mostra 63% e a quantidade de subtasks consideradas

#### Scenario: Card com todas as subtasks concluídas

- **WHEN** todas as subtasks diretas do card estão com status `DONE`
- **THEN** a barra de subtasks aparece em 100%, mantendo o estilo próprio de subtasks

#### Scenario: Subtasks canceladas ficam fora

- **WHEN** o card tem duas subtasks concluídas e uma cancelada
- **THEN** a barra de subtasks mostra 100% e considera apenas as duas concluídas

#### Scenario: Card sem subtasks válidas

- **WHEN** o card não tem filhos ou todos os filhos estão cancelados ou arquivados
- **THEN** a barra de subtasks não é exibida

#### Scenario: Card virtual de história

- **WHEN** uma história não-folha é exibida como card no Kanban
- **THEN** a barra de subtasks considera as tasks filhas da história

#### Scenario: Nome acessível das subtasks

- **WHEN** um leitor de tela percorre o card
- **THEN** a barra de subtasks anuncia o percentual médio e a quantidade de subtasks, em nome distinto das outras barras
