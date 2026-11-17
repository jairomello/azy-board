# Spec Delta

## ADDED Requirements

### Requirement: Paridade dos controles de exibição entre as visualizações
O painel `Opções` SHALL estar disponível em todas as visualizações do board e SHALL exibir
somente os controles com efeito na visão atual. O `Board` SHALL manter todos os controles
de exibição. O `Unificado` SHALL oferecer **Mostrar subtasks** e **Histórias como cards**,
sem os controles exclusivos de lane. A `Árvore` SHALL oferecer **Ocultar épicos vazios** e
**Ocultar histórias vazias**, sem os controles de lane, de subtasks ou de histórias como
cards. **Recalcular datas** e **Exportar dados** SHALL estar disponíveis nas três visões; o
**Caminho crítico** SHALL ser oferecido apenas no Kanban, onde há destaque visual.

#### Scenario: Painel Opções na árvore
- **WHEN** a pessoa abre a visualização `Árvore`
- **THEN** o botão `Opções` está disponível e abre com os controles aplicáveis à grade

#### Scenario: Vazios na árvore
- **WHEN** a pessoa ativa **Ocultar épicos vazios** ou **Ocultar histórias vazias** na árvore
- **THEN** épicos sem descendentes ou histórias sem filhos visíveis deixam de ser exibidos, considerando os demais filtros ativos

#### Scenario: Controles de lane no Unificado
- **WHEN** a pessoa abre `Opções` no `Unificado`
- **THEN** **Mostrar subtasks** e **Histórias como cards** estão disponíveis
- **AND** abas de módulo, expandir/recolher e ocultar épicos/histórias vazios não são exibidos

#### Scenario: Board preservado
- **WHEN** a pessoa abre `Opções` no `Board`
- **THEN** todos os controles continuam disponíveis como antes

#### Scenario: Cronograma e exportação
- **WHEN** a pessoa abre `Opções` em qualquer visualização
- **THEN** **Recalcular datas** e **Exportar dados** permanecem acessíveis

#### Scenario: Caminho crítico fora do Kanban
- **WHEN** a visualização é `Árvore`
- **THEN** o toggle de caminho crítico não é oferecido, porque a grade não desenha o destaque
