# board-drag-animation Specification

## Purpose
Definir como o arraste de cards se comunica e se move no quadro: a vaga de destino, o deslizamento dos demais cards, o assentamento do card arrastado e a reversão quando o destino é recusado.

## Requirements

### Requirement: Vaga de destino durante o arraste
Durante um arraste com destino válido, o quadro SHALL marcar a posição de soltura com uma vaga visível de altura igual à do card arrastado, no lugar da posição de origem. A vaga SHALL NOT ser interativa e SHALL NOT alterar o conteúdo, a ordem persistida ou a contagem de cards da coluna.

#### Scenario: Vaga na posição de soltura
- **WHEN** o usuário arrasta um card folha e o ponteiro cruza o meio de outro card
- **THEN** a vaga aparece na posição de soltura, com a altura do card arrastado, e o card de origem não permanece duplicado na posição antiga

#### Scenario: Vaga sem conteúdo
- **WHEN** a vaga está visível
- **THEN** ela não é clicável nem focável, não altera a contagem exibida da coluna e não é persistida

#### Scenario: Sem destino válido não há vaga
- **WHEN** o ponteiro não está sobre nenhuma coluna elegível
- **THEN** nenhuma coluna é marcada como destino e nenhuma vaga é exibida

### Requirement: Deslizamento da reordenação ao vivo
Os demais cards SHALL deslizar até a ordem de soltura durante o arraste, com a mesma curva e a mesma duração em todos os cards, e SHALL NOT animar quando não mudam de posição. Ao cruzar novamente um ponto médio, o deslizamento SHALL partir da posição atual do card, sem fila de animações.

#### Scenario: Deslizamento na ordem final
- **WHEN** o ponteiro cruza o meio de outro card
- **THEN** os cards afetados deslizam para a ordem que terão depois da soltura, com a mesma curva e duração

#### Scenario: Reordenação repetida sem fila
- **WHEN** o ponteiro cruza pontos médios em sequência rápida, avançando e voltando
- **THEN** cada card continua a partir da posição atual, sem esperar a animação anterior nem acumular deslocamento

#### Scenario: Cards estáveis não animam
- **WHEN** um card não muda de posição na prévia
- **THEN** ele permanece parado

### Requirement: Assentamento preciso do card arrastado
Ao soltar com destino válido, o card arrastado SHALL animar até o retângulo da vaga e SHALL ser substituído pela posição final somente depois de concluir essa animação, sem salto de posição, escala ou rotação residual. A duração do assentamento SHALL ser menor que a da reversão em rejeição.

#### Scenario: Pouso na vaga
- **WHEN** o usuário solta o card sobre uma vaga visível
- **THEN** o card anima até o retângulo da vaga e passa a ocupar a posição final sem deslocamento perceptível

#### Scenario: Sem salto nem resíduo visual
- **WHEN** a animação de assentamento termina
- **THEN** o card exibido coincide com o retângulo da vaga, sem rotação ou escala residual

#### Scenario: Soltar na própria posição
- **WHEN** o usuário solta o card na posição de origem
- **THEN** a posição final é idêntica à inicial e nenhuma animação é necessária

### Requirement: Reversão explícita em rejeição
Quando não houver destino válido sob o ponteiro ou a mutação for recusada, o quadro SHALL NOT marcar nenhuma coluna como destino, SHALL comunicar o motivo e SHALL devolver o card à origem com animação de reversão. A ordem e o status anteriores SHALL ser preservados.

#### Scenario: Soltar fora das colunas
- **WHEN** o usuário solta o card fora de qualquer coluna
- **THEN** nenhuma coluna é marcada como destino, o quadro informa que o movimento foi cancelado e o card retorna à origem com animação

#### Scenario: Recusa do servidor
- **WHEN** a mutação de mover ou de reordenar é recusada
- **THEN** a ordem e o status anteriores são restaurados, o card retorna à origem com animação e o quadro apresenta o motivo

#### Scenario: Destino válido não é rejeitado
- **WHEN** o ponteiro está sobre uma coluna elegível e a mutação é aceita
- **THEN** o quadro não apresenta estado de rejeição nem mensagem de cancelamento

### Requirement: Movimento reduzido
Com a preferência de movimento reduzido ativa, o quadro SHALL aplicar as mudanças do arraste sem deslizamento e sem assentamento animado, com duração zero, apresentando o estado final imediatamente e de forma consistente com o resultado persistido.

#### Scenario: Arraste com movimento reduzido
- **WHEN** o sistema indica preferência por movimento reduzido e o usuário arrasta um card
- **THEN** a reordenação, o assentamento e a reversão acontecem sem animação, com o estado final imediatamente visível

#### Scenario: Consistência após o arraste
- **WHEN** o arraste termina com movimento reduzido ativo
- **THEN** a ordem final e o status exibidos coincidem com o resultado persistido

### Requirement: Compatibilidade com lanes, densidades e temas
O comportamento de arraste SHALL ser o mesmo nos modos SIMPLE e HIERARCHICAL, em lanes distintas, nas densidades confortável e compacta e nos temas claro e escuro, usando as cores do quadro e preservando a legibilidade do card e da vaga.

#### Scenario: Lanes distintas
- **WHEN** o quadro exibe várias lanes e o card é arrastado dentro de uma lane ou entre lanes
- **THEN** a vaga, o deslizamento e o assentamento ocorrem na lane de destino sem afetar as demais

#### Scenario: Densidade compacta
- **WHEN** a densidade compacta está ativa
- **THEN** a vaga usa a altura do card compacto e os cards deslizam sem sobreposição

#### Scenario: Temas claro e escuro
- **WHEN** o tema efetivo muda
- **THEN** a vaga e os estados de destino permanecem legíveis e coerentes com os tokens do quadro
