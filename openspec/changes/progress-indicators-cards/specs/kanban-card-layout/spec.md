# Spec Delta

## MODIFIED Requirements

### Requirement: Região de avanço entre etiquetas e rodapé
O sistema SHALL exibir a barra de avanço do card entre tags/tipo e rodapé sempre que o avanço for maior que zero, com rótulo acessível de avanço no fluxo e indicador legível nos dois temas. Quando o card tiver checklist, o contador `marcados/total` SHALL aparecer junto da barra, sem substituí-la. A barra SHALL usar trilho com cantos arredondados, preenchimento em gradiente derivado dos tokens do tema e marcas discretas de referência. O preenchimento SHALL transicionar de largura ao aparecer ou mudar de valor, exceto quando a preferência `prefers-reduced-motion` estiver ativa, caso em que a barra SHALL aparecer já preenchida e sem animação contínua. Ao atingir 100%, o preenchimento SHALL usar o token de concluído.

#### Scenario: Card com checklists
- **WHEN** existe pelo menos um item de checklist
- **THEN** a barra de avanço e o contador `marcados/total` aparecem entre tags/tipo e rodapé

#### Scenario: Card sem checklists
- **WHEN** não existe item de checklist e o card está em uma coluna cujo peso de avanço é 90
- **THEN** a região exibe a barra em 90%, sem contador de checklist

#### Scenario: Card sem avanço
- **WHEN** o avanço do card é 0, como em uma coluna de trabalho não iniciado
- **THEN** a região de avanço é omitida e não deixa espaço vazio

#### Scenario: Barra no tema escuro
- **WHEN** o tema escuro está ativo
- **THEN** trilho, preenchimento e marcas permanecem distinguíveis e com contraste legível

#### Scenario: Movimento reduzido
- **WHEN** o usuário tem `prefers-reduced-motion: reduce`
- **THEN** a barra aparece preenchida sem transição de largura nem brilho animado
