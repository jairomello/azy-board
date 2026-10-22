# Spec Delta

## ADDED Requirements

### Requirement: Erro determinístico da run não é recuperável
O sistema SHALL classificar como não recuperável o erro determinístico da run (recusa de contrato de aprovação, payload acima do limite, limites de execução). NÃO SHALL reenfileirá-lo com backoff nem consumi-lo como budget de recuperação; SHALL finalizar a run como `FAILED` com o código real do erro, mantendo o commit condicional por proprietário e geração.

#### Scenario: Erro determinístico finaliza com o código real
- **WHEN** a execução da run falha com erro determinístico sob lease vigente
- **THEN** a run é finalizada `FAILED` com o código real do erro, sem nova aquisição e sem `WORKER_LOST`

#### Scenario: Budget de recuperação não é consumido
- **WHEN** o erro determinístico é finalizado na aquisição corrente
- **THEN** nenhum release com backoff é aplicado e o budget de recuperação não é gasto por repetição inútil

#### Scenario: Falha transitória continua recuperável
- **WHEN** a falha da execução não é determinística
- **THEN** a run volta a `QUEUED` com `nextAttemptAt`, preservando o comportamento de retry com backoff

## MODIFIED Requirements

### Requirement: Decisão e retomada por checkpoints idempotentes
Aprovação/reenfileiramento SHALL ser um comando CAS transacional por run/tool/hash/status. Aprovação repetida compatível SHALL retornar decisão existente; divergência/expiração SHALL gerar conflito sem efeito. Checkpoints, mensagens terminais e eventos SHALL ter identidade lógica única; retomada SHALL consultar resultado T38 antes de repetir tool e SHALL NOT limpar cancelamento.

#### Scenario: Aprovação duplicada em duas APIs
- **WHEN** duas requisições aprovam a mesma operação pendente com hash igual
- **THEN** existe uma decisão e um reenfileiramento lógico; workers confirmam a ferramenta uma única vez

#### Scenario: Aprovação divergente ou vencida
- **WHEN** aprovação tem hash/estado incompatível ou expirou
- **THEN** sistema rejeita sem executar e exige nova prévia quando aplicável

#### Scenario: Mensagem terminal após crash
- **WHEN** run completou e mensagem foi persistida antes de crash, mas continuação é retomada
- **THEN** consulta/checkpoint preserva uma mensagem terminal e um conjunto de eventos/resultados sem duplicatas

#### Scenario: Evento de decisão único
- **WHEN** uma aprovação é decidida por qualquer caminho de escrita (rota HTTP ou harness)
- **THEN** exatamente um evento `APPROVAL_DECIDED` é persistido para aquela decisão
