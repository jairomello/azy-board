## MODIFIED Requirements

### Requirement: Registro automático de logs para ações no card
O sistema SHALL gerar automaticamente um evento de auditoria para toda alteração relevante em uma task, sem intervenção do usuário, identificando o executor e a origem da operação.

#### Scenario: Log gerado ao editar dados do card
- **WHEN** usuário ou agente salva alterações em campos do card
- **THEN** evento imutável é criado com `type = 'auto'`, executor real, origem (`REST`, `MCP` ou `SYSTEM`), descrição textual dos campos alterados, data atual e `duration_min = null`

#### Scenario: Log gerado ao mover card de coluna
- **WHEN** usuário ou agente move card para outra coluna no Kanban
- **THEN** evento automático é criado com origem e executor corretos e descrição "Movido de '[Coluna Origem]' para '[Coluna Destino]'"

#### Scenario: Evento automático não é editável
- **WHEN** usuário tenta editar ou excluir evento com `type = 'auto'`
- **THEN** API retorna 403 Forbidden

### Requirement: Descrição de auditoria legível e segura
O sistema SHALL exibir descrições automáticas como texto legível, sem tags HTML cruas ou execução de markup não confiável.

#### Scenario: Alteração em rich text
- **WHEN** auditoria registra alteração de descrição contendo HTML do editor
- **THEN** histórico exibe texto ou diff seguro sem mostrar tags como `<p>` e `<strong>` literalmente

#### Scenario: Origem humano ou agente
- **WHEN** evento foi gerado por usuário, API key, MCP ou sistema
- **THEN** histórico exibe nome/identidade disponível e rótulo de origem correspondente, sem atribuir automaticamente uma operação humana a um robô

### Requirement: Sub-modal de histórico de alterações
O sistema SHALL exibir somente eventos automáticos do card em uma sub-modal de Histórico de alterações, em ordem cronológica decrescente e com contagem independente do diário.

#### Scenario: Abrir histórico
- **WHEN** usuário clica em Histórico de alterações
- **THEN** sub-modal lista eventos automáticos, autor/origem, data, hora e descrição, sem botão de registrar diário

#### Scenario: Contagem de eventos
- **WHEN** card possui eventos automáticos
- **THEN** accordion e sub-modal exibem a quantidade de eventos automáticos registrada

### Requirement: API de auditoria
O sistema SHALL expor leitura paginada de eventos automáticos com filtros de tenant, projeto e card, sem misturar registros manuais.

#### Scenario: Listar auditoria
- **WHEN** membro autenticado consulta o histórico de um card
- **THEN** API retorna somente eventos `auto`, em ordem decrescente, com `total`, executor e origem

#### Scenario: Isolamento e permissão
- **WHEN** usuário consulta card ou evento fora de seu tenant/projeto
- **THEN** API retorna 404 ou 403 conforme o recurso e não revela dados
