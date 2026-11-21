# Spec Delta

## ADDED Requirements

### Requirement: Opções de filtro alinhadas quando quebram linha

Os grupos de opções do painel `Filtros` (Status, Tipo e Tags) SHALL manter as
opções em um contêiner de quebra próprio, separado do rótulo do grupo. Quando as
opções não couberem em uma linha, as linhas seguintes SHALL começar no mesmo
eixo horizontal da primeira opção, nunca sob o rótulo nem com recuo diferente. O
rótulo do grupo SHALL NOT encolher e SHALL ficar alinhado ao topo do bloco de
opções.

#### Scenario: Status quebra para a segunda linha
- **WHEN** a largura do painel não comporta todas as opções de Status em uma linha
- **THEN** as opções restantes passam para a linha seguinte alinhadas sob a primeira opção

#### Scenario: Rótulo do grupo permanece estável
- **WHEN** as opções de Status ocupam mais de uma linha
- **THEN** o rótulo `STATUS` permanece na coluna do rótulo, alinhado à primeira linha

#### Scenario: Grupos com muitas tags ou tipos
- **WHEN** os chips de Tipo ou Tags quebram linha
- **THEN** as linhas seguintes também começam no mesmo eixo da primeira opção do grupo
