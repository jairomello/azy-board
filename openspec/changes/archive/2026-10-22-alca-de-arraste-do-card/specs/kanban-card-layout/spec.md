# Spec Delta

## ADDED Requirements

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
