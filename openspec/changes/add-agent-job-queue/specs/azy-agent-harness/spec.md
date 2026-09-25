## MODIFIED Requirements

### Requirement: Limites, idempotência e cancelamento
Cada run SHALL possuir limites de tempo, tokens, passos, tool calls, payload, concorrência e custo quando disponível, além de `idempotencyKey` para mutações reenviáveis e cancelamento seguro entre processos. A execução SHALL ocorrer no worker (fila persistente), não no request HTTP. O cancelamento SHALL ser efetivo via flag persistida (`cancelRequested`), verificada pelo worker a cada step.

#### Scenario: Limite de passos atingido
- **WHEN** o modelo ultrapassa o limite de iterações ou repete chamadas equivalentes
- **THEN** o harness interrompe a run com estado explícito e não executa novas tools

#### Scenario: Reenvio após reconexão
- **WHEN** uma resposta de rede é reenviada com o mesmo identificador idempotente
- **THEN** a operação não é duplicada e o chat recupera o resultado anterior

#### Scenario: Cancelamento entre processos
- **WHEN** o cliente cancela um run que está sendo executado por um worker em outro processo
- **THEN** o worker detecta a flag `cancelRequested` e interrompe a execução no próximo step

#### Scenario: Retomada após aprovação
- **WHEN** uma aprovação de tool é persistida e o run volta para `QUEUED`
- **THEN** o worker retoma a execução do harness a partir do ponto de aprovação
