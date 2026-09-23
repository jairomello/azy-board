## MODIFIED Requirements

### Requirement: Estado remoto separado e mutações otimistas com rollback
O sistema SHALL manter o estado de servidor na camada de cache, separado do estado de UI, e SHALL aplicar mutações otimistas com rollback quando a operação falhar, sem deixar o cache divergente. Toda mutação SHALL seguir a política única de mutação (otimista com rollback ou reconciliada) definida em `optimistic-mutations`, e mutações otimistas SHALL restaurar o snapshot capturado antes da alteração.

#### Scenario: Atualização otimista revertida em falha
- **WHEN** uma mutação otimista do board falha na API
- **THEN** o cache retorna ao estado anterior e o usuário é informado do erro

#### Scenario: Estado de UI não é persistido como dado de servidor
- **WHEN** o usuário altera um filtro ou abre um modal
- **THEN** esse estado permanece local e não é tratado como dado remoto

#### Scenario: Título revertido em falha
- **WHEN** a alteração otimista de título de um item falha
- **THEN** o título anterior é restaurado no cache e o usuário é informado

#### Scenario: Salvamento atômico de item e tags não diverge
- **WHEN** o usuário salva campos do item e tags em uma única operação
- **THEN** o cache é atualizado a partir da resposta e uma falha não deixa item e tags divergentes

#### Scenario: Conflito de edição reconcilia o cache
- **WHEN** uma mutação retorna 409 `CONFLICT` por o registro ter mudado no servidor
- **THEN** o cache é reconciliado com o estado atual do servidor, sem sobrescrever a versão mais recente
