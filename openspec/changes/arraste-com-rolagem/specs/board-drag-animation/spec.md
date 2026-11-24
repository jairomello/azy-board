# Spec Delta

## ADDED Requirements

### Requirement: Rolagem durante o arraste preserva o destino sob o ponteiro

Quando o quadro rolar durante o arraste de um card — por auto-scroll do dnd-kit
ao segurar o ponteiro junto à borda ou por rolagem manual —, a vaga e a soltura
SHALL usar a coluna que estiver sob o ponteiro **no momento do evento**, e não a
coluna que ocupava aquela posição na largada. A prévia SHALL ser recalculada
também quando apenas a rolagem mudar, sem novo deslocamento do ponteiro, e a
coluna persistida SHALL ser a da vaga exibida.

#### Scenario: Rolagem horizontal com vaga visível
- **WHEN** o fluxo não cabe na tela e o usuário arrasta um card até a borda, fazendo a faixa de colunas rolar
- **THEN** a vaga aparece na coluna que está sob o ponteiro depois da rolagem, dentro da área visível
- **AND** a soltura persiste o card nessa coluna

#### Scenario: Soltura sem novo movimento do ponteiro
- **WHEN** o quadro rola durante o arraste e o usuário solta sem mover o ponteiro novamente
- **THEN** a coluna de destino é a que está sob o ponteiro após a rolagem, e não a que estava ali na largada

#### Scenario: Rolagem vertical nas lanes
- **WHEN** o canvas rola verticalmente durante o arraste de um card em uma lane
- **THEN** a vaga continua no índice correspondente ao ponteiro sobre os cards visíveis e o card pousa nesse índice

#### Scenario: Sem rolagem o comportamento é o mesmo
- **WHEN** o quadro não rola durante o arraste
- **THEN** a vaga, o deslizamento, o assentamento e a reversão seguem exatamente o contrato já existente

#### Scenario: Rolagem não sequestra o gesto
- **WHEN** o arraste termina, é cancelado ou outro arraste começa
- **THEN** os ouvintes de rolagem são removidos e não há recálculo de prévia fora de um arraste
