# item-sequence-code Specification

## Purpose
TBD - created by archiving change item-sequence-code. Update Purpose after archive.
## Requirements
### Requirement: Identificador visual sequencial por tipo e projeto
O sistema SHALL manter um campo `sequence_code` em cada item, composto por prefixo de tipo (E, S, T, B) e número sequencial por projeto (ex: E1, S1, T1, B3). O código SHALL ser único dentro do projeto (tenant_id + project_id + sequence_code).

#### Scenario: Código gerado automaticamente na criação
- **WHEN** membro cria um item via `POST /projects/:id/items` sem enviar `sequenceCode`
- **THEN** sistema gera automaticamente o próximo código disponível para o tipo no projeto (ex: se já existem T1 e T2, o novo TASK recebe T3)

#### Scenario: Código informado pelo usuário na criação
- **WHEN** membro cria um item via `POST /projects/:id/items` com `sequenceCode = "T5"`
- **THEN** sistema valida o formato e unicidade, e persiste o código informado

#### Scenario: Código duplicado rejeitado
- **WHEN** membro tenta criar ou editar um item com `sequenceCode` já existente no mesmo projeto
- **THEN** sistema retorna erro 409 com mensagem indicando conflito

#### Scenario: Formato inválido rejeitado
- **WHEN** membro envia `sequenceCode` que não corresponde ao padrão `[ESTB]\d+`
- **THEN** sistema retorna erro 400 com mensagem descrevendo o formato esperado

#### Scenario: Código editável via PATCH
- **WHEN** membro atualiza `sequenceCode` via `PATCH /projects/:id/items/:itemId`
- **THEN** sistema valida formato e unicidade, e persiste a alteração

#### Scenario: Código nulo permitido
- **WHEN** item não possui `sequenceCode` (items existentes ou campo limpo)
- **THEN** sistema aceita o valor nulo e o item funciona normalmente sem código visual

---

### Requirement: Índice único para sequenceCode
O sistema SHALL criar um índice único composto `(tenant_id, project_id, sequence_code)` na tabela `items` para garantir unicidade do código por projeto.

#### Scenario: Constraint de unicidade no banco
- **WHEN** dois requests simultâneos tentam criar items com o mesmo `sequenceCode` no mesmo projeto
- **THEN** banco rejeita o segundo insert com violação de constraint única

