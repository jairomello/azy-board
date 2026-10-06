# agent-job-queue Specification

## Purpose
TBD - created by archiving change add-agent-job-queue. Update Purpose after archive.
## Requirements
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
Worker SHALL reivindicar runs elegíveis por claim atômico no banco, incrementando geração de lease e attempts uma vez por aquisição. Apenas um proprietário SHALL confirmar efeitos de cada run em qualquer instante; exclusividade SHALL ser imposta por fence, não só pela seleção inicial. Claims SHALL usar tempo do banco, escopo tenant e condição de status/prazo/cancelamento.

#### Scenario: Worker reivindica run
- **WHEN** worker encontra QUEUED elegível sem lease vigente
- **THEN** CAS/lock confirma proprietário/prazo/nova geração/attempts juntos e retorna contexto de posse

#### Scenario: Dois workers competem pelo mesmo run
- **WHEN** dois workers reivindicam a mesma run simultaneamente
- **THEN** apenas um obtém aquisição válida; outro não executa efeito e busca outro job

#### Scenario: Run já reivindicado
- **WHEN** worker tenta reivindicar run com claimExpiresAt maior que tempo do banco
- **THEN** claim não é confirmado e run permanece com proprietário vigente

### Requirement: Lease e heartbeat
Worker SHALL manter lease vigente e sistema SHALL permitir recuperação após expiração. Heartbeat/release/conclusão/escritas SHALL comparar proprietário e geração e SHALL NOT renovar lease já vencido. Toda continuação SHALL ser abortada quando posse se perder; fence SHALL ser verificado no mesmo commit do efeito. Budget de recuperação SHALL ser no máximo três aquisições do mesmo checkpoint sem progresso confirmado, com finalização condicional determinística `FAILED/WORKER_LOST` ao esgotar retries. Espera legítima por aprovação/pergunta e progresso confirmado SHALL iniciar budget do próximo trecho sem zerar geração ou histórico de aquisições.

#### Scenario: Worker atualiza lease durante execução
- **WHEN** heartbeat da geração vigente chega antes de expiry
- **THEN** prazo é estendido pelo tempo do banco sem incrementar attempts/geração

#### Scenario: Worker cai durante execução
- **WHEN** worker encerra sem finalizar run
- **THEN** lease expira após duração configurada e outro worker pode reivindicar nova geração

#### Scenario: Limite de tentativas excedido
- **WHEN** terceira aquisição do mesmo checkpoint falha ou expira sem progresso e recuperação avalia budget
- **THEN** run é finalizada condicionalmente FAILED com WORKER_LOST, sem quarta aquisição nem duplicação de attempts pelo release

#### Scenario: Lease expirado não pode ser ressuscitado
- **WHEN** antigo proprietário envia heartbeat/release/conclusão com geração vencida ou substituída
- **THEN** operação retorna perda de posse sem alterar prazo/status/checkpoint da run vigente

#### Scenario: Várias aprovações legítimas
- **WHEN** run avança checkpoints e volta a QUEUED após mais de três esperas legítimas por aprovação/pergunta
- **THEN** não esgota budget por mero reenfileiramento de progresso, mantendo geração e histórico monotônicos

### Requirement: Retry com backoff
Sistema SHALL reenfileirar falha transitória elegível com backoff exponencial, mantendo checkpoints, decisões e identidade das ferramentas. Attempts SHALL incrementar somente no claim, nunca também no release. Backoff SHALL começar em 5 s e ser limitado a 5 min; retry SHALL respeitar budget, cancelamento, geração e resultado idempotente T38.

#### Scenario: Erro transitório na execução
- **WHEN** provider falha transitoriamente sob lease vigente e há budget
- **THEN** release fenced volta run a QUEUED com nextAttemptAt e preserva checkpoints, sem segundo incremento de attempts

#### Scenario: Backoff é respeitado
- **WHEN** nextAttemptAt está no futuro segundo tempo do banco
- **THEN** run não é reivindicada antes desse instante

#### Scenario: Crash após commit da ferramenta
- **WHEN** ferramenta confirmou domínio e journal T38 mas worker caiu antes de salvar checkpoint
- **THEN** novo worker recupera resultado original pela identidade estável e não repete mutação, auditoria, analytics ou evento

### Requirement: Expiração de runs órfãos
O sistema SHALL expirar runs `QUEUED` sem claim ativo e runs `RUNNING` com lease expirado.

#### Scenario: Run QUEUED sem worker
- **WHEN** um run `QUEUED` não é consumido dentro do timeout configurado
- **THEN** o run é finalizado como `EXPIRED` e o cliente é notificado

#### Scenario: Run RUNNING com lease expirado
- **WHEN** um run `RUNNING` tem `claimExpiresAt < now` (worker morreu)
- **THEN** o run é reivindicado por outro worker ou expirado após `MAX_ATTEMPTS`

### Requirement: Cancelamento entre processos
Cancelamento SHALL ser efetivo entre processos por decisão persistida e transacional. Worker SHALL interromper novas ações, abortar I/O e finalizar condicionalmente como CANCELLED. Efeito cuja transação confirmou antes do cancelamento SHALL permanecer aplicado; efeito que tenta confirmar após cancelamento persistido SHALL ser rejeitado. Cancelamento repetido SHALL devolver estado coerente sem reenfileirar ou alterar run terminal.

#### Scenario: Cancelar run em execução
- **WHEN** cliente solicita cancelamento durante execução em outro processo
- **THEN** cancelRequested é persistido e worker aborta execução, sem permitir próxima tool ou commit tardio

#### Scenario: Cancelar run enfileirado
- **WHEN** cliente cancela QUEUED ainda não adquirida
- **THEN** decisão/status CANCELLED são persistidos atomicamente e run não é executada

#### Scenario: Worker detecta cancelamento
- **WHEN** worker observa cancelRequested true
- **THEN** execução é interrompida e finalização CANCELLED exige posse/estado válidos

#### Scenario: Cancelamento concorre com commit
- **WHEN** decisão de cancelamento e transação da tool competem
- **THEN** ordem de confirmação no banco determina resultado único: commit anterior permanece, cancelamento anterior bloqueia efeito e não há nova execução

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

