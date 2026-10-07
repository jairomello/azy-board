Board ref: 32b627cf-18d5-4d0e-b7fb-323638e8e7e3

## 1. Contratos e interfaces de reconciliação

- [x] 1.1 Alinhar eventId/sequence/replay/watermark/paginação/retenção T38 e root/health T36; condicionar liberação multi-API com agente a T37.
- [x] 1.2 Evoluir `packages/realtime-contracts` com schemaVersion/eventId/watermark/token/control de confirmação e negociação de versão, mantendo compatibilidade e validação runtime.
- [x] 1.3 Definir barreira replay-live e refetch com revisão antes/depois, limites de buffer/tentativas e refetch obrigatório de cursor legado.
- [x] 1.4 Mapear invalidadores/handlers web e salas/assinaturas/cursors por chave tenant-projeto; preservar funções pequenas, tipos strict e comentários `[TENANT]`/`[DB-SWAP]` nos boundaries.

## 2. Transporte confirmado entre APIs

- [x] 2.1 Conectar dispatcher T38 ao CoordinationPort.publish ADVANCED em canais versionados instalação/tenant/projeto; usar entrega local SIMPLE sem publicação duplicada de rota.
- [x] 2.2 Implementar subscribe por salas autorizadas com recursos Redis subscriber próprios, validação de envelope e teardown/lifecycle idempotentes.
- [x] 2.3 Refatorar `services/websocket.ts` para usar identidade/sequence recebidas de T38, removendo alocação local e isolando rooms/cursors/replay por tenant/projeto.
- [x] 2.4 Implementar dedup e consumo contíguo/buffer limitado; buscar lacuna via replay SQL ou emitir RESYNC sem encaminhar eventos fora de ordem.
- [x] 2.5 Revalidar autorização de handshake/replay/salas periodicamente e ao mudar membership; interromper entrega revogada sem vazamento.

## 3. Recuperação e protocolo servidor

- [x] 3.1 Comparar high-watermarks de salas ativas em lote a cada heartbeat e reconexão de subscriber, recuperando inclusive última mensagem perdida sem evento posterior.
- [x] 3.2 Implementar replay paginado até watermark com live bufferizado, limite de 1.000 e RESYNC para cursor inválido/legado/gap/retenção/overflow.
- [x] 3.3 Implementar token/barreira de refetch e confirmação client-side, comparando revisão antes/depois das consultas sem assumir snapshot de múltiplos GETs.
- [x] 3.4 Integrar falha de subscription/Valkey à readiness/syncing e recuperação de salas, mantendo SQL/outbox como verdade e contador estável no restart.
- [x] 3.5 Acrescentar métricas lag/idade/gaps/dedup/refetch e logs sanitizados, evitando labels de cardinalidade ilimitada.

## 4. Cliente e indicador honesto

- [x] 4.1 Atualizar `useWebSocket.ts` para validar scope/sequence, ignorar duplicatas, detectar lacunas e controlar geração de conexão/projeto.
- [x] 4.2 Corrigir refetch para manter syncing em falha/handler ausente e retentar, removendo sucesso após catch; descartar respostas de geração antiga.
- [x] 4.3 Aplicar replay/barreira/ack e invalidadores por revisão sem regredir snapshot; indicar synced somente após reconciliação contígua completa.
- [x] 4.4 Reconciliar carga inicial de consultas com handshake e eventos concorrentes; preservar reconexão/backoff/heartbeat sem alarme de erro na UI.
- [x] 4.5 Testar client/control legado no rollout e forçar refetch quando cursor/protocolo não é contínuo com sequência global.

## 5. Prova com duas APIs e clientes distintos

- [x] 5.1 Criar harness CI de dois processos API ADVANCED em portas distintas, PostgreSQL/Valkey reais e dois clientes/browser presos a réplicas distintas.
- [x] 5.2 Testar mutações simultâneas A/B e dados convergentes, ordem global, evento duplicado/fora de ordem e ack pós-publish perdido.
- [x] 5.3 Testar subscriber atrasado, perda silenciosa da última mensagem sem publicação posterior e high-watermark acionando recuperação.
- [x] 5.4 Testar restart da API/dispatcher/Valkey e desconexão curta/longa, replay retido versus refetch e contador que não reinicia.
- [x] 5.5 Testar mutação durante refetch, falha de uma consulta, overflow de buffer e socket/projeto trocado; provar ausência de synced prematuro.
- [x] 5.6 Testar tenant/projeto/revogação cross-instance e payload/canal inválidos; verificar que nenhum evento cruza autorização.
- [x] 5.7 Reexecutar testes focados de realtime SIMPLE sem Valkey e contratos de heartbeat/backoff/invalidadores, além do gate duas APIs.

## 6. Rollout e operação

- [x] 6.1 Documentar limites de retenção/replay, Pub/Sub transitório, alertas de lag e procedimento de recuperação/refetch sem promessa de HA geral.
- [x] 6.2 Ensaiar rollout de protocolo/web/servidor com cutover de cursor legado e rollback para uma API sem apagar contador/outbox nem migrar perfis.
- [x] 6.3 Integrar ensaio multi-instância ao CI e entregar evidências de processos/clientes distintos e indicador para gates globais do coordenador.
