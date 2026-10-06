Board ref: 32b627cf-18d5-4d0e-b7fb-323638e8e7e3

## Context

`proposal.md` complementa T38. `services/websocket.ts` mantém rooms/replayState por projectId, aloca sequence em `broadcast` e usa ring buffer local; `index.ts` registra Redis Pub/Sub como trabalho futuro. `coordination/{ports,redis,local}.ts` já expõe publish/subscribe/readiness. `packages/realtime-contracts` contém envelopes/control messages e `useWebSocket.ts` mantém cursor, mas aceita toda sequence e marca synced após `.catch(() => {})` do refetch. Histórico `5376de2` e `realtime-sync/spec.md` definem uma boa base de reconciliação em uma API, não transporte durável distribuído.

`installation-profiles/spec.md` proíbe apresentar Pub/Sub como fila/replay e mantém multi-instância condicionada aos dependentes. T38 é dono do evento, sequência e replay persistido; T39 é dono de transporte, consumo, handshake e estado do cliente. Não duplicar outbox ou counter em Valkey.

## Goals / Non-Goals

**Goals:** evento confirmado na API A reconciliado por clientes na B; dedup/ordenação/isolamento; recuperação após perda silenciosa e restart; indicador honesto; ensaio operacional reproduzível.

**Non-Goals:** HA completa, eleição de banco, persistir fila do agente em Valkey, migrar perfis, novo journal/outbox e extração T40. Topologia com agente depende também de T37 verificado.

## Decisions

1. **Pub/Sub como aceleração, SQL como verdade.** Dispatcher T38 publica envelope confirmado com eventId/sequence no canal versionado por instalação/tenant/projeto via `CoordinationPort`. Subscriber valida schema e scope e entrega só a suas salas autorizadas. Não fazer broadcast local extra na rota (evita dupla emissão); SIMPLE usa adapter local do mesmo fluxo confirmado. Lease/ack de dispatcher já pertence a T38; T39 não cria publisher com semântica concorrente. Redis Streams como fonte de replay foi rejeitado por criar segunda persistência/ordenação e por não tornar Pub/Sub durável.
2. **Sequência global por projeto, sem renumerar.** Consumidor usa sequence alocada por T38 sob tx de projeto. Deduplicar eventId e sequence por tenant/projeto; duplicata não avança cursor nem reaplica. Eventos fora de ordem são retidos em buffer limitado enquanto SQL fornece sequência faltante; não encaminhar n+2 como se n+1 estivesse aplicado. Unique e schemaVersion também detectam envelope incoerente. Rooms/cursors/replay APIs usam chave composta tenant/projeto, nunca somente ID, com autenticação/membership atuais no handshake e replay. Revogação fecha sala no evento de metadados e revalidação periódica, sem tratar canal interno como autorização.
3. **Recuperação sem próximo evento.** Além do aviso Pub/Sub, cada API compara high-watermark SQL de salas ativas a cada heartbeat (intervalo existente de contrato), por consulta em lote tenant-scoped. Se publisher/subscriber perde última mensagem e nenhuma outra chega, diferença dispara leitura/replay ou RESYNC. Reconexão ao barramento refaz comparação antes de declarar pronto; subscription failure marca salas syncing e readiness degradada, mantendo dados confirmados na outbox. Cursor efêmero da instância é reconstruído do SQL; restart não zera contador.
4. **Retenção limitada e replay paginado.** Consumir port T38 com pelo menos 24 h de eventos, contador permanente e até 1.000 eventos por reconciliação; páginas limitadas, nunca replay integral de projeto. Cursor inválido, à frente, legado sem continuidade, fora da retenção ou backlog acima do limite gera RESYNC_REQUIRED com watermark/razão tipados. Pub/Sub/replayState local não bastam como prova de completude. Perda de conexão curta reproduz eventos SQL; perda longa exige snapshot. Métricas registram lag/idade/dedup/gaps/refetch, sem tenant como label de cardinalidade ilimitada.
5. **Barreira replay/live e snapshot.** Assinar/bufferizar live antes de ler watermark W; reenviar eventos (cursor,W] e drenar buffer contíguo, só então enviar REPLAY_COMPLETE(W aplicado). Para refetch, servidor fornece token de reconciliação/watermark escopado e bufferiza eventos posteriores; cliente responde controle aditivo após consultas ativas concluírem. Refetch sem snapshot transacional usa leitura com revisão: comparar watermark antes/depois das consultas e repetir se avançou, com limite de tentativas e estado syncing sob atividade constante. Aplicar dados novos por revisão/invalidação, nunca deixar evento anterior regredir snapshot. Após confirmação, drenar eventos > W; overflow exige nova ressincronização. Essa barreira fecha corrida entre REST refetch e WS que marcar cursor ao abrir socket não resolve.
6. **Cliente valida e confirma progresso.** `useWebSocket.ts` valida tipos/scope, ignora duplicatas ≤ cursor e detecta lacuna > cursor+1 antes de chamar handler. Novo socket/projeto possui geração de conexão: respostas de refetch/replay antigas são descartadas. `synced` exige replay contíguo até watermark ou refetch/ack/barreira completos; falha/missing handler de refetch mantém syncing e retenta, não absorve erro e sinaliza sucesso. Primeiro connect também reconcilia snapshot/WS para não perder mutação durante carga inicial. Heartbeat informa high-watermark para detectar lag, não é evento de domínio.
7. **Evolução de protocolo/deploy.** Acrescentar campos opcionais de eventId/schemaVersion/watermark/token e control de ack nos contratos; negociar versão no handshake. Clientes legados recebem RESYNC/fallback compatível e não entram no caminho distribuído que exija ack desconhecido; rollout atualiza web/servidor de forma coordenada e força refetch do cursor legado. Validar envelope runtime em vez de cast JSON. Assinaturas usam conexões Redis apropriadas a subscriber separadas de publisher; teardown remove subscribe/timers sem fechar recursos usados por outra sala.
8. **Teste duas APIs e navegadores reais.** PostgreSQL/Valkey compartilhados, APIs em portas distintas, dois clientes presos a réplicas diferentes. Mutação simultânea de ambas, dispatch duplicado/fora de ordem, atraso de subscriber, perda da última mensagem, crash após publish, restart da API/Barramento, gap de retenção e refetch que falha. Controlar barreiras/fault injection sem sleeps como única evidência; verificar dados/cursor/indicador e ausência de eventos cross-tenant/projeto.

## Risks / Trade-offs

- [Pub/Sub confirma sem subscriber receber] → SQL replay e reconciliação por high-watermark, mesmo sem nova publicação.
- [Projetos quentes pressionam counter/replay] → counter transacional T38 e batch de high-watermarks, limite de buffers/replay; projeto em atividade pode permanecer syncing até uma barreira válida.
- [Carga de permissões/revogação] → queries escopadas em lote e fechamento/invalidação no evento de membership, com revalidação periódica de autorização.
- [Cliente legado usa cursor local incompatível] → versionamento de protocolo e refetch obrigatório no cutover, sem tentar converter número local em sequência global.
- [Dois processos mascarados por teste local] → CI inicia listeners distintos e transporta por Valkey real; prova também restart e cliente sem mudança de réplica.

## Migration Plan

Integrar T36/T38 primeiro e publicar contratos/web com refetch compatível. Schema/counter/retenção são migrations T38 no próprio perfil; T39 não migra dados históricos nem perfis. Subir subscriber/dispatcher em uma API, validar lag/readiness e então ensaio com duas APIs. Liberar documentação multi-instância somente com T37 e demais controles verificados; compartilhar instalação/volumes segundo deploy, nunca misturar marcadores. Rollback drena outbox por versão compatível, força clientes a refetch e reduz para uma API; não zerar contador nem apagar eventos pendentes.

## Open Questions

Nenhuma decisão de produto pendente. Métodos físicos de replay/watermark serão alinhados a T38; a garantia de continuidade não depende do nome desses ports.
