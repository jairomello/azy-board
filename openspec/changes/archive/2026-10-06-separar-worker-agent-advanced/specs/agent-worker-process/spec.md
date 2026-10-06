Board ref: 341ba802-bef6-4659-a15d-385749b469c1

## MODIFIED Requirements

### Requirement: Worker de execução do agente
O sistema SHALL ter worker que consome a fila persistente e executa runs separado do request HTTP. SIMPLE SHALL iniciar worker in-process por modo explícito `IN_PROCESS`; ADVANCED SHALL usar entrada/processo `SEPARATE`, sem listener HTTP, e a API SHALL NOT consumir runs. Configuração cruzada SHALL ser recusada. O callback SHALL reconstruir usuário, tenant, conversa, disponibilidade, governança e modelos do banco, sem confiar em identidade/permissões/segredos enviados no job, e SHALL revalidar autorização antes de cada tool. O callback SHALL receber contexto interno de posse vigente com geração e AbortSignal.

#### Scenario: Worker consome run da fila
- **WHEN** há runs `QUEUED` disponíveis e worker ativo no modo do perfil
- **THEN** reivindica o run com geração de lease, executa harness e persiste resultados/eventos sob fence

#### Scenario: Worker é iniciado com a API
- **WHEN** `startServer()` inicia em SIMPLE com modo IN_PROCESS e há runs enfileiradas
- **THEN** worker inicia automaticamente e processa runs, incluindo a cadeia de modelos ativa do tenant

#### Scenario: Contexto da run vem do banco
- **WHEN** worker reivindica run
- **THEN** reconstrói usuário/tenant/conversa por IDs persistidos e usa governança/modelos atuais sem confiar em identidade ou segredo do job

#### Scenario: Worker roda no perfil SIMPLE
- **WHEN** instalação usa SIMPLE sem serviços externos
- **THEN** worker in-process usa claim/fence SQLite e não exige processo externo

#### Scenario: Worker roda no perfil ADVANCED
- **WHEN** API e worker separado iniciam em ADVANCED
- **THEN** somente worker reivindica runs PostgreSQL, API pode reiniciar sem cancelar execução elegível e worker não abre listener HTTP

#### Scenario: Disponibilidade ou permissão muda antes da execução da tool
- **WHEN** ROOT desabilita agente ou permissão muda enquanto run espera
- **THEN** worker revalida estado antes da tool e bloqueia efeito não autorizado

#### Scenario: Modo incompatível com perfil
- **WHEN** ADVANCED é configurado com IN_PROCESS ou entrada separada é indevidamente escolhida no modo SIMPLE suportado
- **THEN** inicialização é recusada com erro operacional claro em vez de criar dois consumidores implícitos

### Requirement: Coordenação entre workers
O sistema SHALL coordenar workers por claim atômico no banco e lease com geração monotônica. Toda escrita/efeito de execução SHALL validar tenant, proprietário, geração, lease não vencido e estado elegível na mesma transação do efeito. Ao perder posse, worker SHALL abortar execução e impedir novas chamadas, gravações ou conclusões; cálculos/I/O antigos já em andamento SHALL NOT confirmar efeitos com geração obsoleta.

#### Scenario: Worker secundário assume run abandonado
- **WHEN** primário cai e lease expira
- **THEN** secundário reivindica nova geração e continua de checkpoint/resultados persistidos

#### Scenario: Dois workers no perfil ADVANCED
- **WHEN** dois workers competem por run e primário pausado retorna depois de recuperação pelo secundário
- **THEN** somente proprietário vigente confirma efeitos, e toda escrita/conclusão da geração antiga é rejeitada

### Requirement: Observabilidade do worker
O sistema SHALL registrar métricas/logs de profundidade e idade da fila, latência de claim, runs ativos, tentativas, lease perdido, abort, fence rejeitado e operação externa incerta. Profundidade SHALL vir de agregação real, não do tamanho de uma consulta limitada a uma run. Logs SHALL correlacionar worker/run/tool/geração sem segredos; guias SHALL definir diagnóstico/alerta para fila sem consumidor e lease churn.

#### Scenario: Métricas de fila
- **WHEN** worker está ativo e há várias runs elegíveis
- **THEN** métricas mostram profundidade real, latência, ativos e tentativas, independentemente do limite de polling

#### Scenario: Log de claim e conclusão
- **WHEN** worker reivindica/conclui run
- **THEN** log estruturado registra worker/run/geração/status/duração sem credenciais

#### Scenario: Falha de posse é observável
- **WHEN** heartbeat falha e continuação antiga tenta escrever
- **THEN** abort e rejeição de fence são registrados e o operador pode distinguir perda de posse de falha de provider

## ADDED Requirements

### Requirement: Abort e shutdown preservam a posse
Worker SHALL propagar AbortSignal ao harness/provider/tool, serializar polling e vincular cleanup à aquisição específica. Heartbeat inconclusivo SHALL bloquear novos efeitos e abortar até prova de posse, sem fallback permissivo. SIGTERM SHALL parar claims e drenar/abortar com prazo; release SHALL ser fenced. Resultado tardio SHALL NOT limpar a referência ou finalizar run de nova geração.

#### Scenario: Provider responde após lease perdido
- **WHEN** worker perde lease durante await do provider e recebe resposta tardia
- **THEN** signal está abortado, resposta é descartada e nenhuma próxima tool/mensagem/evento é confirmada

#### Scenario: Finally antigo e novo claim
- **WHEN** execução de uma aquisição encerra depois de nova geração ser ativa
- **THEN** cleanup só altera sua própria aquisição e não remove activeRun nem estado do novo dono

#### Scenario: Shutdown do worker
- **WHEN** SIGTERM chega durante run
- **THEN** worker não busca outra run, aborta/drena dentro do prazo e não faz release/conclusão de lease alheio

### Requirement: Fronteira de efeitos externos após perda de posse
Worker SHALL validar posse antes de dispatch externo e descartar resultado após revogação. Para operação externa mutante com resultado ambíguo, SHALL exigir chave idempotente/reconciliação do destino antes de retry e SHALL NOT repetir cegamente. Abort SHALL NOT ser apresentado como reversão de chamada já aceita; mutações do board SHALL confirmar somente via journal T38 com fence na transação.

#### Scenario: Chamada externa aceita antes de crash
- **WHEN** destino aceitou efeito mas worker cai antes de persistir resposta e destino não permite consultar/deduplicar operationId
- **THEN** retomada bloqueia repetição automática, registra resultado incerto para reconciliação e não anuncia exatamente uma execução externa
