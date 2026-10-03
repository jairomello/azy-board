## ADDED Requirements

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
