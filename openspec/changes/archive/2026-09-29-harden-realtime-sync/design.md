## Context

O canal WebSocket (`apps/api/src/services/websocket.ts`, `apps/web/src/hooks/useWebSocket.ts`) é só de notificação: mutações passam pela API REST e `broadcast()` avisa os clientes conectados à sala do projeto. Hoje:

- `WsEvent` é `{ type, projectId, payload }` sem ordem nem identidade (`packages/realtime-contracts/src/index.ts:18-22`) — impossível saber o que se perdeu numa queda.
- O hook marca `synced` no `onopen` (`useWebSocket.ts:25`) e `retryDelay` é recriado a cada reconexão (`useWebSocket.ts:24`), quebrando o backoff; não há heartbeat — conexão zumbi fica presa em `synced`.
- 4 tipos no contrato nunca são emitidos (`CARD_CREATED`, `CARD_DELETED`, `SPRINT_CHANGED`, `PROGRESS_UPDATED`); `ITEM_UPDATED` de archive/unarchive (`items.ts:1221/1262`) e `CARD_UPDATED` de reorder (`items.ts:169`) têm payloads que o reducer não aplica; ~20 rotas de mutação não emitem nada (colunas, sprints, tags, versões, membros, squads, cost centers, módulos editados/excluídos, tags/sprint/work-log do item, anexos).
- A reconciliação por refetch no reconnect já existe nas telas (Item 17 e continuação: `useBoardData.ts:205-214`, `ProjectDashboardPage.tsx:85-89`, `ProjectSettingsScreen.tsx:32-40`) — a lacuna é de honestidade e de eventos perdidos, não de refetch.
- A UI exibe "Sincronizado" e "Atualizações em tempo real" (`BoardContext.tsx:38-52`, i18n `board.json:192-195`).

Existe `item_events.sequence` no banco (`db/schema.ts:650`), mas é histórico analítico com enum próprio — reutilizá-lo acoplaria analytics a realtime. O `CoordinationPort` (`coordination/ports.ts:17-21`) tem pub/sub mas é para coordenação, não replay.

## Goals / Non-Goals

**Goals:**

- Eventos ordenados por `sequence` monotônico por projeto, com replay por cursor na reconexão.
- Quando o replay não for possível (gap grande, servidor reiniciado), o cliente recebe uma ordem explícita de ressincronização e refaz as consultas ativas — nunca finge que está `synced`.
- Heartbeat nos dois sentidos e descarte de conexões zumbis (cliente e servidor).
- Backoff exponencial que persiste entre tentativas.
- Estado visual honesto: `connecting → syncing → synced` (ou `offline`), com "Sincronizado" só após reconciliação de fato.
- Contrato sem tipos legados e com cobertura das mutações do produto; payloads que o cliente aplica de verdade.
- Testes de backoff, máquina de estados, replay/ressincronização e cobertura de eventos.

**Non-Goals:**

- Replay persistente entre reinícios do servidor (outbox no banco) ou fan-out entre instâncias (Redis Pub/Sub) — ficam como ponto de troca `[DB-SWAP]` documentado.
- Presença/avatares de usuários em tempo real, chat ou cursor compartilhado.
- Mudanças no modelo de dados ou nas regras de negócio de itens.
- Garantia de entrega exatamente-uma-vez; o modelo é *ao menos uma vez* com reconciliação idempotente.

## Decisions

1. **Sequência monotônica por projeto em memória, alocada no `broadcast()`.** Cada sala guarda um contador e um *ring buffer* dos últimos N eventos (500). Na reconexão o cliente envia `since=<sequence>`; o servidor reenvia o que falta ou manda `RESYNC_REQUIRED`. *Alternativa:* outbox em tabela com cursor persistente — rejeitada por complexidade e por não ser necessária em instância única (perfil SIMPLE); o buffer cobre quedas curtas e o fallback cobre o resto.

2. **Cursor via query param `since` no handshake, não mensagem de hello.** O upgrade (`index.ts:155-183`) já valida projeto/membership; ler `since` ali é atômico com a conexão e evita estado intermediário "conectado sem replay". *Alternativa:* mensagem `HELLO` pós-conexão — rejeitada por abrir janela de eventos perdidos entre `open` e `HELLO`.

3. **Controle de sincronização no envelope, fora do contrato de domínio.** Mensagens do servidor têm `kind: 'event' | 'control'`; controles são `REPLAY_COMPLETE` (com `sequence` atual) e `RESYNC_REQUIRED`. `WsEvent` de domínio ganha apenas `sequence: number`, continuando compatível com os handlers por tipo.

4. **Heartbeat de aplicação, mensagens `HEARTBEAT`.** O servidor envia heartbeat a cada 20s; o cliente registra `lastMessageAt` e, se nada chegar em 2× o intervalo, trata como zumbi: fecha e reconecta. O servidor descarta peers cujo envio falha ou que não respondem ao ping do protocolo. *Alternativa:* ping/pong do protocolo WebSocket apenas — o browser não expõe pong ao JS, então o cliente não teria como detectar zumbi; a mensagem de aplicação cobre os dois lados.

5. **`syncing` como estado explícito; `synced` só pós-reconciliação.** O hook expõe `connecting | syncing | synced | offline`. `synced` só é setado após `REPLAY_COMPLETE` **e** conclusão do callback de ressincronização (quando houver `RESYNC_REQUIRED`). As telas registram seu invalidador como `onResync`; o padrão `wasOfflineRef` existente passa a usar esse callback em vez de disparar refetch às cegas no `synced`.

6. **Eventos demais para patch incremental → invalidação do board.** Reorder de cards/colunas passa a emitir payload com `itemIds`/`columnId` tratado como *refetch* (a query do board é monolítica; patch de ordem seria frágil). Archive/unarchive ganham payload com `itemIds` que o reducer aplica incrementalmente. Criam-se duas categorias em `realtimeEvents.ts`: `BOARD_PATCH_EVENT_TYPES` (patch) e `BOARD_INVALIDATE_EVENT_TYPES` (refetch do board) — honestidade de mecanismo por evento.

7. **Metadados de projeto viram um tipo único com discriminador.** `PROJECT_METADATA_CHANGED { section }` com `section` ∈ `columns|modules|sprints|tags|versions|members|squads|costCenters|project` cobre ~15 rotas mudas sem inflar o contrato; Settings e Dashboard invalidam pela seção afetada. Detalhes do item (tags, sprint, work-log, logs, anexos) emitem `ITEM_UPDATED` com `itemId`, aproveitando a invalidação existente do dashboard.

8. **Tipos legados saem do contrato; `SPRINT_CHANGED` passa a ser emitido.** `CARD_CREATED`, `CARD_DELETED` e `PROGRESS_UPDATED` nunca existiram de fato e são removidos (as rotas reais já emitem `ITEM_*`); `SPRINT_CHANGED` é exigido pela spec e passa a ser emitido pelas rotas de sprint (abrir/fechar/ativar/CRUD).

## Risks / Trade-offs

- [Replay em memória se perde com reinício do servidor] → `sequence` zera e o cursor do cliente fica à frente do contador do servidor; isso dispara `RESYNC_REQUIRED` (comparação `since > current` ou fora do buffer), e o refetch reconcilia — comportamento degradado, nunca incorreto.
- [Ring buffer fixo (500 eventos/projeto) pode não cobrir quedas longas] → mesmo fallback acima; o tamanho é configurável e o custo é previsível.
- [`RESYNC_REQUIRED` pode causar refetch em massa de um projeto] → apenas consultas ativas do projeto afetado; já é o comportamento atual do reconnect, sem novo pico.
- [Cobertura ampliada de eventos aumenta tráfego] → eventos são pequenos e por sala; metadados usam um tipo único com seção; sem payload de entidade inteira.
- [Múltiplas instâncias quebrariam sequência/buffer] → fora de escopo; `index.ts:137` já marca `[DB-SWAP]` para pub/sub; documentar que `sequence` é válida por processo.
- [Remover tipos legados quebra consumidores externos] — não há consumidores além do web (contrato é monorepo-only); os testes de contrato são atualizados junto.

## Migration Plan

1. Estender `realtime-contracts` (`sequence`, envelope de controle, novos tipos, remoção dos legados) mantendo os tipos restantes com os mesmos nomes.
2. Servidor: sequência + buffer + replay no handshake, heartbeat, `SPRINT_CHANGED`, broadcast das rotas mudas, correção de payloads.
3. Cliente: hook com cursor, backoff, heartbeat, máquina de estados e `onResync`; `realtimeEvents.ts` com as duas categorias de board.
4. Telas: Board/Dashboard/Settings consomem o novo estado e o `onResync`; textos de i18n.
5. Testes e docs; `bun run check` + `bun run test:smoke` + validação manual de queda de rede.

Rollback: as mudanças de contrato e de cliente são acopladas (deploy único do monorepo); em regressão, reverter o commit devolve o comportamento anterior sem migração de dados.

## Open Questions

- O ring buffer deve ser por projeto (como previsto) ou global por tenant com filtro? — começando por projeto, que já é a chave de sala e o escopo de isolamento.
- Convém expor a `sequence` atual em métricas/health para diagnóstico? — candidato barato para `health-endpoints` em change posterior.
