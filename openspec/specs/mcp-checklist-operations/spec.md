# mcp-checklist-operations Specification

## Purpose
Definir resolução semântica e operações em lote para itens de checklist via MCP.

## Requirements
### Requirement: Resolução semântica de checklist
As ferramentas de checklist SHALL aceitar resolução alternativa por `itemId`, nome exato do checklist e texto/posição do passo. A resolução SHALL ocorrer dentro do card informado, normalizar apenas espaços/case conforme a regra documentada e rejeitar zero ou múltiplos resultados sem escolher silenciosamente. Os caminhos existentes por IDs SHALL continuar disponíveis.

#### Scenario: Resolver passo único por nome
- **WHEN** o agente informa `itemId`, `checklistName` e `text` e há um único passo compatível
- **THEN** o servidor resolve os IDs e executa a operação solicitada

#### Scenario: Nenhum passo compatível
- **WHEN** não existe checklist ou passo compatível no card
- **THEN** o servidor retorna erro acionável com os critérios recebidos e sugere listar checklists

#### Scenario: Mais de um passo compatível
- **WHEN** mais de um passo corresponde ao texto informado
- **THEN** o servidor retorna conflito com candidatos e exige IDs ou `position`

### Requirement: Atualização de checklist em lote
O sistema SHALL expor ferramenta `check_items` para marcar/desmarcar até 100 passos em uma operação atômica por card. Cada entrada SHALL aceitar IDs ou a forma semântica documentada e o resultado SHALL informar `matched`, `updated` e falhas/conflitos por entrada. Se uma entrada inválida impedir a operação atômica, nenhum passo SHALL ser alterado.

#### Scenario: Lote atômico bem-sucedido
- **WHEN** agente invoca `check_items` com passos válidos dentro do limite
- **THEN** todos os passos são atualizados e o servidor retorna contagens agregadas e itens alterados

#### Scenario: Lote excede limite
- **WHEN** agente envia mais de 100 passos
- **THEN** servidor rejeita antes da execução com mensagem acionável e nenhum passo é alterado

#### Scenario: Lote tem conflito semântico
- **WHEN** uma entrada possui múltiplos candidatos
- **THEN** todo o lote é rejeitado atomicamente e a resposta identifica a entrada conflitante e os IDs candidatos

### Requirement: Catálogo e skill documentam o fluxo
A nova ferramenta e seus parâmetros SHALL ser declarados no registry compartilhado, ter dispatcher, policy, limites e testes de contrato, e SHALL ser documentados na skill oficial.

#### Scenario: Catálogo completo
- **WHEN** `bun run test:mcp-catalog` é executado
- **THEN** a ferramenta `check_items` possui definição, schema, policy, routing, executor e documentação correspondente
