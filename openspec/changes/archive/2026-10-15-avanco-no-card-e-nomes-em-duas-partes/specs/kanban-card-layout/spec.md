# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: Região de progresso de checklist entre etiquetas e rodapé`
- TO: `### Requirement: Região de avanço entre etiquetas e rodapé`

## MODIFIED Requirements

### Requirement: Região de avanço entre etiquetas e rodapé

O sistema SHALL exibir a barra de avanço do card entre tags/tipo e rodapé sempre que o avanço for maior que zero, com rótulo acessível de avanço no fluxo e indicador legível nos dois temas. Quando o card tiver checklist, o contador `marcados/total` SHALL aparecer junto da barra, sem substituí-la.

#### Scenario: Card com checklists

- **WHEN** existe pelo menos um item de checklist
- **THEN** a barra de avanço e o contador `marcados/total` aparecem entre tags/tipo e rodapé

#### Scenario: Card sem checklists

- **WHEN** não existe item de checklist e o card está em uma coluna cujo peso de avanço é 90
- **THEN** a região exibe a barra em 90%, sem contador de checklist

#### Scenario: Card sem avanço

- **WHEN** o avanço do card é 0, como em uma coluna de trabalho não iniciado
- **THEN** a região de avanço é omitida e não deixa espaço vazio
