# Spec Delta

## MODIFIED Requirements

### Requirement: Registro automático de logs para ações no card

O sistema SHALL gerar automaticamente um evento de auditoria para toda alteração relevante em uma task, sem intervenção do usuário, identificando o executor e a origem da operação.

#### Scenario: Log gerado ao editar dados do card

- **WHEN** usuário ou agente salva alterações em campos do card (título, descrição, prioridade, responsável, tags, pontos, tokens de entrada/saída, datas)
- **THEN** evento imutável é criado com `type = 'auto'`, executor real, origem (`REST`, `MCP` ou `SYSTEM`), descrição textual dos campos alterados, data atual e `duration_min = null`

#### Scenario: Log gerado ao mover card de coluna

- **WHEN** usuário ou agente move card para outra coluna no Kanban
- **THEN** evento automático é criado com origem e executor corretos e descrição "Movido de '[Coluna Origem]' para '[Coluna Destino]'"

#### Scenario: Log gerado ao alterar tokens

- **WHEN** usuário ou agente registra ou limpa tokens de entrada/saída de um card, individualmente ou em lote
- **THEN** evento automático é criado com executor real, origem (`REST`, `MCP` ou `SYSTEM`) e descrição textual dos tokens alterados

#### Scenario: Log automático não é editável

- **WHEN** usuário tenta editar ou excluir evento com `type = 'auto'`
- **THEN** API retorna 403 Forbidden
