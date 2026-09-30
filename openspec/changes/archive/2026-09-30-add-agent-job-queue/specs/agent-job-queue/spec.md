## ADDED Requirements

### Requirement: Fila persistente de jobs do agente
O sistema SHALL enfileirar cada run do Azy Agent em uma fila persistente (tabela `assistant_runs` com colunas de lease/claim), garantindo que runs sobrevivam a restart do processo e sejam consumidos por um worker.

#### Scenario: Run é enfileirado
- **WHEN** uma mensagem é enviada ao Azy Agent
- **THEN** o run é persistido com status `QUEUED`, `claimedBy = NULL` e `nextAttemptAt = now`, e a API responde 202 imediatamente

#### Scenario: Processo reinicia com runs pendentes
- **WHEN** o processo HTTP reinicia com runs `QUEUED` ou `RUNNING` na fila
- **THEN** os runs permanecem na fila e são consumidos pelo worker após o restart

#### Scenario: Run enfileirado após aprovação
- **WHEN** uma aprovação de tool é persistida via `POST /runs/:runId/approval`
- **THEN** o run é reenfileirado (`QUEUED`) em vez de executar inline no HTTP

### Requirement: Claim atômico e execução única
O worker SHALL reivindicar runs por claim atômico (UPDATE condicional), garantindo que no máximo um worker execute cada run em qualquer instante.

#### Scenario: Worker reivindica run
- **WHEN** o worker busca runs disponíveis e encontra um `QUEUED` sem claim ativo
- **THEN** o claim é feito por UPDATE CAS (`SET claimedBy = worker, claimExpiresAt = lease WHERE status = 'QUEUED'`), e apenas um worker obtém sucesso

#### Scenario: Dois workers competem pelo mesmo run
- **WHEN** dois workers tentam reivindicar o mesmo run simultaneamente
- **THEN** apenas um obtém `changes = 1`; o outro ignora e busca outro run

#### Scenario: Run já reivindicado
- **WHEN** o worker tenta reivindicar um run com claim ativo (`claimExpiresAt > now`)
- **THEN** o run não é reivindicado e o worker busca outro

### Requirement: Lease e heartbeat
O worker SHALL manter lease ativo durante a execução e o sistema SHALL reivindicar runs com lease expirado.

#### Scenario: Worker atualiza lease durante execução
- **WHEN** o worker está executando um run
- **THEN** `claimExpiresAt` é estendido periodicamente (heartbeat) para `now + LEASE_MS`

#### Scenario: Worker cai durante execução
- **WHEN** o processo do worker é encerrado sem finalizar o run
- **THEN** após `LEASE_MS`, o lease expira e outro worker pode reivindicar o run

#### Scenario: Limite de tentativas excedido
- **WHEN** um run é reivindicado mais de `MAX_ATTEMPTS` vezes sem conclusão
- **THEN** o run é finalizado como `FAILED` com `errorCode = 'WORKER_LOST'`

### Requirement: Retry com backoff
O sistema SHALL reenfileirar runs que falharam por erro transitório com backoff exponencial.

#### Scenario: Erro transitório na execução
- **WHEN** o worker encontra erro transitório (ex.: timeout do provider) durante a execução
- **THEN** o run volta para `QUEUED` com `nextAttemptAt = now + backoff` e `attempts` incrementado

#### Scenario: Backoff é respeitado
- **WHEN** um run está com `nextAttemptAt` no futuro
- **THEN** o worker não o reivindica até `nextAttemptAt`

### Requirement: Expiração de runs órfãos
O sistema SHALL expirar runs `QUEUED` sem claim ativo e runs `RUNNING` com lease expirado.

#### Scenario: Run QUEUED sem worker
- **WHEN** um run `QUEUED` não é consumido dentro do timeout configurado
- **THEN** o run é finalizado como `EXPIRED` e o cliente é notificado

#### Scenario: Run RUNNING com lease expirado
- **WHEN** um run `RUNNING` tem `claimExpiresAt < now` (worker morreu)
- **THEN** o run é reivindicado por outro worker ou expirado após `MAX_ATTEMPTS`

### Requirement: Cancelamento entre processos
O cancelamento SHALL ser efetivo mesmo quando o run está sendo executado por outro processo.

#### Scenario: Cancelar run em execução
- **WHEN** o cliente envia `POST /runs/:runId/cancel` durante a execução
- **THEN** a flag `cancelRequested` é persistida e o worker interrompe a execução no próximo step

#### Scenario: Cancelar run enfileirado
- **WHEN** o cliente cancela um run `QUEUED`
- **THEN** o run é finalizado como `CANCELLED` sem ser executado

#### Scenario: Worker detecta cancelamento
- **WHEN** o worker verifica `cancelRequested = true` durante o loop
- **THEN** a execução é interrompida e o run finalizado como `CANCELLED`
