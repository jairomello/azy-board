Board ref: 32b627cf-18d5-4d0e-b7fb-323638e8e7e3

## Why

Sequência, ring buffer e salas de `services/websocket.ts` são locais ao processo: clientes ligados à API B não recebem mutações confirmadas na API A. T39 é P1 porque reconexão em uma instância não garante sincronização enquanto duas réplicas estão ativas, nem detecta evento perdido sem mensagem posterior.

## What Changes

- Distribuir somente eventos confirmados da outbox T38 pelo `CoordinationPort`/Valkey em ADVANCED; manter entrega local SIMPLE sem serviços externos.
- Consumir identidade e sequência durável por tenant/projeto, com deduplicação, ordenação, replay limitado e refetch explícito para lacunas.
- Recuperar falha/reinício do publisher ou subscriber sem confiar na retenção do Pub/Sub; detectar lag inclusive quando nenhum novo evento chega.
- Garantir isolamento na assinatura, entrega e replay, e barreira de reconciliação: cliente não mostra `Sincronizado` antes de replay/refetch bem-sucedido.
- Testar duas APIs e clientes distintos, mutações simultâneas, desconexão, restart, indisponibilidade de Valkey e retenção excedida.

## Capabilities

### New Capabilities

- `distributed-event-delivery`: entrega entre APIs, recuperação de lag e operação do barramento por perfil.

### Modified Capabilities

- `realtime-sync`: sequência/replay duráveis, isolamento tenant/projeto e estado honesto do cliente sob lacunas e falhas de refetch.

## Impact

- `apps/api/src/services/websocket.ts`, `index.ts`, `coordination/{ports,local,redis}.ts`, integração da outbox T38 e `packages/realtime-contracts`.
- `apps/web/src/hooks/useWebSocket.ts`, invalidadores em `lib/realtimeEvents.ts`, testes de integração/browser, CI e guias de deploy.
- Depende de T36 para duas APIs PostgreSQL operacionais e T38 para IDs/sequências/replay/outbox; T37 deve estar verificado antes de habilitar topologia multi-API com agente. T39 não cria outra outbox, fila de agente nem pacote executor T40.
- Protocolo evolui de forma aditiva e rollout força refetch inicial de cursores legados; SIMPLE mantém operação sem Valkey. Não há migração entre perfis nem promessa de HA geral somente com Pub/Sub.
