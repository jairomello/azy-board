# item-sequence-code Specification

## Purpose
Identificar visualmente cada item por código sequencial único por tipo e projeto, sustentado por índice único no banco e numeração automática na criação — inclusive em lote — e na correção via MCP.

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

---

### Requirement: Numeração automática na criação em lote e correção via MCP
O sistema SHALL gerar `sequence_code` também na criação em lote (tools `batch` e `create_project_structure`), escolhendo o próximo número livre por tipo no projeto de forma atômica dentro do lote, sem colidir com códigos existentes nem duplicar entre operações do mesmo lote. O resultado da criação em lote SHALL expor o `sequenceCode` gerado. As tools `update_item` e `update_items` SHALL aceitar o campo `sequenceCode` em `changes`, validando formato `[ESTB]\d+` e unicidade por projeto, e SHALL permitir limpar o campo.

#### Scenario: Criação em lote numera cada tipo sequencialmente
- **WHEN** um agente cria, via `batch`, TASKs e BUGs em um projeto cujos TASKs vão até T2 e BUGs até B1
- **THEN** as TASKs recebem T3, T4, … e os BUGs recebem B2, B3, …, na ordem das operações, e cada resultado do lote retorna o `sequenceCode` gerado

#### Scenario: Lote continua a contagem existente
- **WHEN** o projeto já possui T1, T3 (T2 removido) e um novo TASK é criado em lote
- **THEN** o novo TASK recebe T4 (maior número existente + 1), sem reutilizar T2

#### Scenario: Sem duplicação dentro do mesmo lote
- **WHEN** um lote cria várias operações do mesmo tipo
- **THEN** cada uma recebe um código distinto e sequencial, sem colisão entre operações do próprio lote

#### Scenario: Editar código por update_item
- **WHEN** um agente envia `update_item` com `changes: [{ field: "sequenceCode", operation: "SET", value: "T10" }]`
- **THEN** o item passa a ter `sequenceCode = "T10"` e a alteração é refletida na resposta

#### Scenario: Editar código em lote por update_items
- **WHEN** `update_items` aplica `sequenceCode` a múltiplos itens filtrados
- **THEN** cada item recebe o valor informado e a unicidade é validada sobre o resultado

#### Scenario: Código duplicado rejeitado
- **WHEN** o `sequenceCode` informado já pertence a outro item do projeto (ou a outro item do mesmo lote)
- **THEN** a operação é rejeitada sem aplicar alterações, com erro acionável de conflito

#### Scenario: Formato inválido rejeitado
- **WHEN** o valor informado não corresponde a `[ESTB]\d+`
- **THEN** a operação é rejeitada antes da rede, com mensagem descrevendo o formato esperado

#### Scenario: Limpar o código
- **WHEN** o agente envia `sequenceCode` com `operation: "CLEAR"`
- **THEN** o campo passa a nulo e a unicidade não é afetada

