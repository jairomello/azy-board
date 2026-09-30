## MODIFIED Requirements

### Requirement: Paridade schema-validator-executor

O catálogo SHALL falhar em teste quando metadata, campos obrigatórios, nullable, filtros, validator, policy ou dispatcher divergirem. A paridade SHALL valer para campos de topo e para nós aninhados do `inputSchema` (objetos e itens de arrays), incluindo a forma declarada do nó — objeto ou array — e não apenas a obrigatoriedade dos campos.

#### Scenario: Attachment exige item

- **WHEN** `list_attachments` é validada
- **THEN** schema e validator concordam sobre `itemId`

#### Scenario: Filtros de listagem

- **WHEN** `list_tasks` ou `get_tree` suporta um filtro no executor
- **THEN** o schema estrito e validator representam o mesmo filtro

#### Scenario: Datas de sprint

- **WHEN** `create_sprint` exige datas na execução
- **THEN** schema e validator representam a mesma obrigatoriedade

#### Scenario: Forma mínima aceita em todas as ferramentas

- **WHEN** o teste de paridade monta, para cada ferramenta, o payload que informa apenas os campos obrigatórios de topo e aninhados
- **THEN** a validação aceita o payload e a exposição do schema marca exatamente aqueles campos como obrigatórios

#### Scenario: Forma do nó de alteração confere com o validador

- **WHEN** `update_item`, `update_items`, `update_checklist`, `update_checklist_item` ou `update_item_log` declara o nó `changes`
- **THEN** o schema declara a mesma forma (objeto ou array) que o validador aceita e que o executor consome

## ADDED Requirements

### Requirement: Schema de alteração próprio por ferramenta

Cada ferramenta de atualização SHALL declarar o schema do argumento `changes` com os campos que o respectivo executor consome, sem reutilizar o schema de alteração de outra ferramenta. `update_checklist` SHALL aceitar `name` e `position`; `update_item_log` SHALL aceitar `activity` e `durationMin`; `update_checklist_item` SHALL continuar usando o schema de item de checklist. O validador SHALL rejeitar chaves desconhecidas em `changes`.

#### Scenario: Atualizar nome e posição de checklist

- **WHEN** o agente invoca `update_checklist` com `changes` contendo `name` e/ou `position`
- **THEN** o servidor aceita as alterações e retorna a checklist atualizada

#### Scenario: Atualizar texto e duração de log de trabalho

- **WHEN** o agente invoca `update_item_log` com `changes` contendo `activity` e/ou `durationMin`
- **THEN** o servidor aceita as alterações e retorna o log atualizado

#### Scenario: Chave desconhecida em alteração é rejeitada

- **WHEN** o agente invoca `update_checklist`, `update_checklist_item` ou `update_item_log` com uma chave de `changes` fora do conjunto aceito pela ferramenta
- **THEN** o servidor retorna erro de validação identificando a chave rejeitada, sem alterar o recurso

#### Scenario: Alteração vazia não corrompe o recurso

- **WHEN** o agente invoca uma ferramenta de atualização com `changes` sem nenhum campo informado
- **THEN** o servidor trata como não informado e não altera o recurso, ou retorna erro de validação claro quando a ferramenta exige ao menos uma alteração
