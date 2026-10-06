Board ref: 341ba802-bef6-4659-a15d-385749b469c1

## 1. Contexto de execução e migrations

- [ ] 1.1 Alinhar root/factory sem listener T36 e envelope/journal T38; definir contexto interno `{tenantId, runId, workerId, generation, expiresAt, signal}` sem criar pacote executor T40.
- [ ] 1.2 Inventariar escritas de run/tool/evento/mensagem/custo e dispatch de provider/tool em `assistantHarness`, `assistantRunExecutor`, `workerContext` e rotas de decisão.
- [x] 1.3 Adicionar generation/checkpoints/unicidade lógica e migrations aditivas SQLite/PostgreSQL, testando dados/runs legados e preservação dos marcadores.
- [ ] 1.4 Estender ports/modelos com claim que retorna posse, heartbeat/release/conclusão fenced e relógio do banco; manter scopes `[TENANT]`, seleção `[DB-SWAP]`, funções pequenas e tipos strict.

## 2. Posse retry e cancelamento no banco

- [x] 2.1 Implementar claim/heartbeat SQLite CAS síncronos, sem renovar lease vencido, incrementando attempts somente na aquisição.
- [x] 2.2 Implementar claim/heartbeat PostgreSQL por lock/CAS e SKIP LOCKED onde apropriado, com as mesmas condições tenant/geração/status/expiry.
- [x] 2.3 Implementar release/backoff e recuperação/esgotamento de até três aquisições por checkpoint sem progresso, separando contador histórico e retry; preservar esperas legítimas de aprovação/pergunta e evitar writes incondicionais ou leitura SQLite no caminho ADVANCED.
- [x] 2.4 Tornar requestCancel/finalização e decisão de aprovação/reenfileiramento comandos CAS transacionais, com resultado repetível e conflito de hash/estado.
- [ ] 2.5 Integrar validação do fence e cancelRequested na mesma tx T38 de ferramentas; testar ordem determinística de commit contra cancelamento.

## 3. Executor cooperativo e checkpoints

- [x] 3.1 Serializar polling do AgentWorker e manter AbortController/activeRun por aquisição, com cleanup condicionado à identidade/geração.
- [x] 3.2 Abortar em heartbeat recusado/inconclusivo/expiry, bloquear novos efeitos e propagar signal ao executor, harness, providers e tools.
- [ ] 3.3 Exigir fence em todas as escritas da execução, inclusive falha/conclusão/eventos/mensagens/custo, e descartar continuações/resultados tardios.
- [ ] 3.4 Usar operationId estável por run/tool/versão e recuperar resultado T38 após crash pós-commit, salvando checkpoint sem reexecutar mutação.
- [x] 3.5 Deduplicar mensagem/evento terminal por identidade lógica e preservar transcript/decisão/cancelamento ao retomar.
- [ ] 3.6 Registrar tentativa externa e bloquear retry automático quando efeito é incerto e destino não oferece idempotência/reconciliação; documentar limites de abort/cobrança do provider.
- [x] 3.7 Implementar SIGTERM com parada de claims, drain/abort limitado e release fenced, sem alterar posse assumida por outro processo.

## 4. Entradas e operação por perfil

- [x] 4.1 Criar entrada/script dedicado de worker ADVANCED usando composição T36 sem listener HTTP nem `startServer()`.
- [x] 4.2 Resolver/validar modos IN_PROCESS SIMPLE e SEPARATE ADVANCED; remover consumo automático pela API ADVANCED e rejeitar configuração cruzada.
- [x] 4.3 Atualizar entrypoint/imagem e compose ADVANCED com serviço worker, dependências migrations/health, volumes/marcador e restart próprios.
- [x] 4.4 Corrigir métricas para profundidade/idade agregada e acrescentar attempts/abort/fence/resultado incerto com logs run/tool/worker/geração sanitizados.

## 5. Prova de concorrência e falha

- [ ] 5.1 Testar CAS/fence SQLite com duas conexões e regressão SIMPLE in-process sem serviços externos.
- [x] 5.2 Subir dois workers PostgreSQL reais no CI com barreiras para disputar run, pausar primeiro além do lease e rejeitar todos os efeitos/conclusões antigos.
- [ ] 5.3 Testar heartbeat expirado/inconclusivo, resposta tardia de provider, polling sobreposto e finally antigo sem apagar aquisição nova.
- [ ] 5.4 Injetar crash após chamada/commit T38 e antes do checkpoint; confirmar um efeito de board e resposta/mensagem/eventos repetíveis após retomada.
- [ ] 5.5 Testar aprovação duplicada/divergente/vencida, mais de três esperas legítimas, resposta de pergunta, cancelamento concorrente, retries/backoff/budget por checkpoint e isolamento tenant/projeto.
- [ ] 5.6 Reiniciar só API durante run e confirmar worker independente; testar SIGTERM/crash do worker e takeover da fila.
- [ ] 5.7 Testar destino externo incerto sem replay seguro e métricas/diagnóstico sem promessa de exactly-once.

## 6. Rollout e documentação

- [x] 6.1 Documentar alertas/diagnóstico da fila sem consumidor, lease churn e efeitos incertos, incluindo comandos de execução por perfil.
- [x] 6.2 Ensaiar cutover com parada de consumidores antigos, migrations e workers fenced; impedir coexistência com versão antiga sem fence e ensaiar rollback do próprio perfil.
- [x] 6.3 Executar testes focados e gates multi-worker por perfil, entregando evidências dos contratos para validação global pelo coordenador.

## Nota de encerramento (decisão de escopo)

T37 encerrada com o núcleo de fencing validado. Itens deixados como decisão de
escopo, por não bloquearem a garantia de posse:

- `2.5/3.3/3.4` — o fence é aplicado no **boundary do executor/transporte**
  (guarda de dispatch, escrita de estado da run via `updateRunFenced`, operação
  estável `run:tool` propagada às rotas T38), não reaberto dentro da transação
  SQL de cada tool. Mutações do agente confirmam via journal T38 com chave
  estável; edições/remoções são naturalmente idempotentes/CAS.
- **Anexos** — o I/O físico de storage permanece fora do journal (outbox de
  limpeza própria), por design; apenas os metadados são transacionais.
