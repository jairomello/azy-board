# Spec Delta

## ADDED Requirements

### Requirement: Campos de metadados do tracker no catálogo

O catálogo compartilhado SHALL declarar os campos de metadados do tracker em `create_task`, `update_item` e `update_items` e SHALL incluir os mesmos campos na projeção de `list_tasks`. Os campos são opcionais: `externalSource`, `externalRef`, `assigneeLabel`, `actualStartDate` e `actualDueDate`. A validação SHALL aceitar os campos apenas quando declarados na ferramenta e SHALL rejeitar campos desconhecidos com a mensagem acionável existente. O catálogo continua sendo a fonte única; nenhuma lista paralela SHALL ser mantida em `apps/mcp`.

#### Scenario: Criar tarefa com metadados
- **WHEN** um agente chama `create_task` com `externalSource`, `externalRef`, `assigneeLabel` e as datas realizadas
- **THEN** a chamada é aceita pelo schema, validada e repassada à API com os mesmos valores

#### Scenario: Atualizar metadados
- **WHEN** um agente chama `update_item` com `changes` contendo `assigneeLabel` ou uma das datas realizadas
- **THEN** a mudança é aceita, validada e aplicada ao item

#### Scenario: Projeção em list_tasks
- **WHEN** um agente pede `fields` com `externalRef`, `assigneeLabel` ou uma das datas realizadas em `list_tasks`
- **THEN** a projeção inclui o campo no payload

#### Scenario: Campo desconhecido
- **WHEN** um agente envia um campo que não pertence à ferramenta
- **THEN** a validação rejeita com a mensagem que lista os campos aceitos, sem ignorar silenciosamente
