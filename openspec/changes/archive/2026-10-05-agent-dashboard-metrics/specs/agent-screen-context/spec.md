## ADDED Requirements

### Requirement: Fotografia do contexto do Dashboard

Quando a tela ativa é `project-dashboard`, o frontend SHALL capturar e transportar, junto da fotografia versionada, os filtros de população vigentes (módulo, sprint, versão, squad, responsável, tipo e demais filtros de população do Dashboard) e o período (`from`/`to`), com a mesma semântica de ausência de valor do restante da fotografia. O bloco SHALL ser opcional: sua ausência NÃO SHALL causar erro e a consulta degrada para os filtros explícitos do pedido. O bloco do Dashboard MUST NOT alterar o escopo de mutação em lote do board (`scope`/`results`/`view`).

#### Scenario: Filtros do Dashboard viajam na fotografia

- **WHEN** o usuário envia uma mensagem enquanto está no Dashboard com módulo e período selecionados
- **THEN** a fotografia inclui os filtros de população e o período vigentes do Dashboard

#### Scenario: Ausência de valor expressa por operador

- **WHEN** o Dashboard está sem sprint ou sem versão selecionadas
- **THEN** a fotografia expressa a ausência por operador tipado, e não como sentinela da interface ou nome de entidade

#### Scenario: Bloco ausente não falha

- **WHEN** a fotografia é capturada sem o bloco do Dashboard
- **THEN** o transporte continua válido e a consulta usa apenas os filtros explícitos do pedido

#### Scenario: Escopo de mutação do board permanece íntegro

- **WHEN** a fotografia carrega o bloco do Dashboard
- **THEN** o escopo de `scope`/`results`/`view` usado por mutações em lote do board não é alterado
