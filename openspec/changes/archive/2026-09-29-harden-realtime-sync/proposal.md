## Why

O WebSocket do produto dá garantia visual maior do que a implementação oferece (item 20 da análise de sistema): o hook marca `synced` logo no `onopen` (`useWebSocket.ts:25`), sem reconciliação; o backoff exponencial está quebrado porque `retryDelay` é recriado a cada reconexão (`useWebSocket.ts:24`); não há heartbeat nem detecção de conexão zumbi; eventos ocorridos durante uma desconexão são perdidos (não há sequência, cursor nem replay); 4 tipos legados (`CARD_CREATED`, `CARD_DELETED`, `SPRINT_CHANGED`, `PROGRESS_UPDATED`) existem no contrato mas nunca são emitidos — sendo que `SPRINT_CHANGED` é exigido pela spec `realtime-sync` —; e dezenas de mutações não emitem evento algum (colunas, sprints, tags, versões, membros, squads, centros de custo, módulos editados/excluídos, tags/sprint/work-log do item, anexos). Enquanto isso a UI mostra "Sincronizado" e "Atualizações em tempo real" (`BoardContext.tsx:38-52`), prometendo coerência que o canal não garante.

## What Changes

- **Sequência e replay por cursor:** eventos ganham `sequence` monotônico por projeto; o servidor mantém um buffer limitado de eventos recentes; o cliente informa o último cursor ao (re)conectar e recebe o replay dos eventos perdidos — ou uma ordem explícita de ressincronização quando o gap não é recuperável (fallback para refetch das consultas ativas).
- **Heartbeat e detecção de conexão zumbi:** mensagens de heartbeat no nível da aplicação nos dois sentidos; cliente trata conexão muda como queda e reconecta; servidor descarta peers mortos.
- **Backoff exponencial correto:** `retryDelay` persiste entre tentativas e é resetado apenas após conexão estável, com limite de 30s.
- **Estado de sincronização honesto:** o status deixa de ser `synced` no ato de conectar e passa por `connecting → syncing → synced` (ou `offline`), só exibindo "Sincronizado" após a reconciliação (replay aplicado ou refetch concluído). A UI separa "conectado" de "dados reconciliados" (`BoardContext.tsx`, `BoardScreen.tsx`, `ProjectDashboardPage.tsx`, i18n pt-BR/en/es).
- **Contrato limpo e completo:** remoção dos tipos legados nunca emitidos; emissão real de `SPRINT_CHANGED` nas rotas de sprint (cobrindo a exigência da spec); correção dos eventos que hoje são no-op no cliente (archive/unarchive de item sem `itemId`, reorder sem id); eventos para as mutações mudas (metadados do projeto e detalhes do item) via tipo único de metadados com discriminador de seção, para as telas invalidarem as consultas certas.
- **Testes:** backoff e máquina de estados do hook; handshake de replay/ressincronização no servidor; correção dos payloads no-op; contratos de cobertura de eventos por mutação e de ausência de tipos legados.

## Capabilities

### New Capabilities
<!-- Nenhuma. A capacidade `realtime-sync` já existe; esta change a torna verdadeira. -->

### Modified Capabilities
- `realtime-sync`: requisitos de reconexão passam a exigir backoff exponencial correto, heartbeat/detecção de zumbi e reconciliação por replay (cursor/sequência) ou ressincronização explícita; tipos de eventos passam a cobrir as mutações do produto sem tipos legados; novo requisito de estado de sincronização honesto na UI.
- `client-cache`: a reconciliação no reconnect passa a poder ocorrer por replay de eventos além do refetch das consultas ativas — o requisito é ajustado para aceitar os dois mecanismos.

## Impact

- **Contratos:** `packages/realtime-contracts/src/index.ts` (`WsEvent` ganha `sequence`; novos tipos `PROJECT_METADATA_CHANGED`, `HEARTBEAT`, mensagens de handshake `HELLO`/`REPLAY`/`RESYNC_REQUIRED`; remoção de `CARD_CREATED`, `CARD_DELETED`, `PROGRESS_UPDATED`).
- **API:** `apps/api/src/services/websocket.ts` (buffer por projeto, replay, heartbeat, descarte de peers mortos); `apps/api/src/index.ts` (handshake); rotas `items.ts`, `checklists.ts`, `projects.ts`, `columns.ts`, `sprints.ts`, `tags.ts`, `versions.ts`, `attachments.ts`, `batch.ts` (broadcast das mutações mudas, `SPRINT_CHANGED` real, payloads no-op corrigidos).
- **Web:** `hooks/useWebSocket.ts` (cursor, backoff, heartbeat, estados `connecting/syncing/synced/offline`, callback de ressincronização); `lib/realtimeEvents.ts` (mapas de eventos novos, sem legados); `features/board/hooks/useBoardData.ts` (reducer cobre payloads corrigidos e metadados); `components/BoardContext.tsx`, `features/board/BoardScreen.tsx`, `pages/ProjectDashboardPage.tsx`, `features/project-settings/ProjectSettingsScreen.tsx` (estado honesto + ressincronização).
- **i18n:** `apps/web/src/i18n/locales/{pt-BR,en,es}/board.json` e `dashboard.json` (textos de status).
- **Testes:** novos testes de unidade/contrato em `apps/api` e `apps/web`; preservar `realtimeCache.test.ts`, `realtimeEvents.test.ts`, contratos do Item 17/continuação.
- **Docs:** `docs/ANALISE-SISTEMA.md` (item 20) e `docs/azyboard-wiki/04 - Board e Visualizacoes/Sincronizacao em Tempo Real.md`.
- **Rastreabilidade:** Board ref: bf602847-203b-41ba-ad7d-fff932c28e86 (card "Item 20: WebSocket dá aparência de sincronização mais forte do que oferece").
- **Fora de escopo:** persistência de replay além do processo (outbox no banco / Redis Pub/Sub para múltiplas instâncias — fica registrado como limitação e ponto de troca `[DB-SWAP]`); presença de usuários/avatares em tempo real; canal de chat; mudanças no modelo de dados de itens.
