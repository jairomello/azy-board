# Spec Delta

## ADDED Requirements

### Requirement: Apresentação do board com níveis ocultados

Em projetos `HIERARCHICAL` com a opção de ocultar módulos e/ou épicos ligada, o
board Kanban SHALL pular o nível correspondente: sem módulos, os épicos aparecem
no nível do projeto; sem épicos, as histórias aparecem sob o módulo ou no nível
do projeto; sem ambos, histórias e cards aparecem diretamente. A ordem e o
arraste dos cards SHALL ser preservados.

#### Scenario: Board sem módulos

- **WHEN** o projeto tem módulos ocultos e épicos visíveis
- **THEN** o board não renderiza swimlanes de módulo e exibe as swimlanes de épico diretamente

#### Scenario: Board sem épicos

- **WHEN** o projeto tem épicos ocultos e módulos visíveis
- **THEN** o board não renderiza swimlanes de épico e exibe as histórias/cards sob cada módulo

#### Scenario: Board sem módulos nem épicos

- **WHEN** o projeto tem as duas opções ligadas
- **THEN** o board exibe histórias e cards diretamente, sem módulos nem épicos

#### Scenario: Movimentação preservada

- **WHEN** níveis estão ocultos
- **THEN** TASKs, BUGs e histórias folha continuam arrastáveis entre colunas conforme as regras vigentes
