# Spec Delta

## ADDED Requirements

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
