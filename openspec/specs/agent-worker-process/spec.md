# agent-worker-process Specification

## Purpose
TBD - created by archiving change add-agent-job-queue. Update Purpose after archive.
## Requirements
### Requirement: Worker de execução do agente
O sistema SHALL ter um worker iniciado pelo lifecycle da API que consome a fila persistente de jobs e executa os runs do Azy Agent, separado do ciclo de vida do request HTTP. O callback de execução SHALL reconstruir usuário, tenant, conversa, disponibilidade, governança e modelos a partir do banco; não SHALL confiar em identidade, permissões ou credenciais contidas nos argumentos da fila. O worker SHALL revalidar autorização antes de executar cada tool.

#### Scenario: Worker consome run da fila
- **WHEN** há runs `QUEUED` disponíveis e o worker está ativo
- **THEN** o worker reivindica o run, executa o harness e persiste eventos/resultados

#### Scenario: Worker é iniciado com a API
- **WHEN** `startServer()` inicia no perfil suportado e há runs enfileiradas
- **THEN** o worker é iniciado automaticamente e processa as runs, incluindo a cadeia de modelos ativa do tenant

#### Scenario: Contexto da run vem do banco
- **WHEN** o worker reivindica um run
- **THEN** reconstrói usuário, tenant e conversa por IDs persistidos, carrega governança e modelos atuais do tenant e não usa identidade ou segredo enviados pelo job

#### Scenario: Worker roda no perfil SIMPLE
- **WHEN** a instalação usa o perfil SIMPLE (SQLite, sem serviços externos)
- **THEN** o worker roda in-process no servidor API com claim CAS, sem exigir processo separado

#### Scenario: Worker roda no perfil ADVANCED
- **WHEN** a instalação usa o perfil ADVANCED (PostgreSQL + Redis)
- **THEN** o worker iniciado no servidor pode reivindicar runs pela fila PostgreSQL, usando `FOR UPDATE SKIP LOCKED` quando suportado e sem depender de um processo externo não configurado

#### Scenario: Disponibilidade ou permissão muda antes da execução da tool
- **WHEN** o ROOT desabilita o agente ou a autorização do usuário muda enquanto um run aguarda na fila
- **THEN** o worker revalida o estado atual antes da tool e bloqueia a execução se não for mais permitida

### Requirement: Coordenação entre workers
O sistema SHALL coordenar múltiplos workers via claim atômico no banco e lease com expiração.

#### Scenario: Worker secundário assume run abandonado
- **WHEN** o worker primário cai e o lease de um run expira
- **THEN** o worker secundário reivindica o run e continua a execução

#### Scenario: Dois workers no perfil ADVANCED
- **WHEN** dois workers estão ativos no perfil ADVANCED
- **THEN** cada run é executado por no máximo um worker (claim atômico)

### Requirement: Rate limiting distribuído
O sistema SHALL usar o `CoordinationPort` para rate limiting de requisições ao Azy Agent, funcionando corretamente em múltiplas instâncias.

#### Scenario: Rate limit no perfil SIMPLE
- **WHEN** o rate limit é verificado no perfil SIMPLE
- **THEN** usa a implementação local (in-process), equivalente ao comportamento atual

#### Scenario: Rate limit no perfil ADVANCED
- **WHEN** o rate limit é verificado no perfil ADVANCED
- **THEN** usa a implementação Redis (INCR/EXPIRE), compartilhada entre instâncias

#### Scenario: Orçamento diário atômico
- **WHEN** o orçamento diário é verificado
- **THEN** a verificação é atômica (transação ou UPDATE condicional), sem corrida de leitura-escrita

### Requirement: Retomada após aprovação e resposta do usuário
O worker SHALL retomar runs que voltaram para `QUEUED` após aprovação de tool ou resposta do usuário a uma pergunta.

#### Scenario: Run retoma após aprovação
- **WHEN** uma aprovação é persistida e o run volta para `QUEUED`
- **THEN** o worker reivindica o run e continua a execução a partir do ponto de aprovação

#### Scenario: Run retoma após resposta do usuário
- **WHEN** o usuário responde a uma pergunta via `POST /runs/:runId/question`
- **THEN** o run volta para `QUEUED` e o worker retoma a execução

### Requirement: Observabilidade do worker
O sistema SHALL registrar métricas e logs do worker para diagnóstico operacional.

#### Scenario: Métricas de fila
- **WHEN** o worker está ativo
- **THEN** métricas de profundidade da fila, latência de claim, runs ativos e tentativas são registradas (OTel)

#### Scenario: Log de claim e conclusão
- **WHEN** o worker reivindica ou conclui um run
- **THEN** um log estruturado registra worker ID, run ID, status e duração
