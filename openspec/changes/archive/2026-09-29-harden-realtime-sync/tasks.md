## 1. Contrato compartilhado

- [x] 1.1 Estender `packages/realtime-contracts/src/index.ts`: `WsEvent` ganha `sequence: number`; envelope de controle do servidor (`kind: 'event' | 'control'`) com mensagens `REPLAY_COMPLETE` (carrega a `sequence` atual) e `RESYNC_REQUIRED`; tipo `PROJECT_METADATA_CHANGED { section }` com discriminador (`columns|modules|sprints|tags|versions|members|squads|costCenters|project`); tipo `HEARTBEAT`
- [x] 1.2 Remover do contrato os tipos legados nunca emitidos: `CARD_CREATED`, `CARD_DELETED`, `PROGRESS_UPDATED`; manter `SPRINT_CHANGED` (será emitido na task 3.5)
- [x] 1.3 Atualizar os testes de contrato do pacote e `apps/web/src/lib/realtimeEvents.test.ts` para o novo contrato (sem legados, com `sequence` e controles)

## 2. Servidor: sequência, replay e heartbeat

- [x] 2.1 Em `apps/api/src/services/websocket.ts`: sequência monotônica por projeto alocada no `broadcast()`, com ring buffer dos últimos N eventos (500) por sala; `sequence` no envelope de todo evento
- [x] 2.2 Handshake com cursor: ler `since` do query string no upgrade (`apps/api/src/index.ts`), reenviar eventos do buffer após o cursor e encerrar com `REPLAY_COMPLETE`; quando o cursor estiver fora do buffer, maior que a sequência atual ou incoerente, enviar `RESYNC_REQUIRED`
- [x] 2.3 Heartbeat do servidor (intervalo 20s) e descarte de peers cujo envio falhe; handler de mensagem do servidor trata respostas de heartbeat sem virar evento de domínio
- [x] 2.4 Testes do servidor: alocação de sequência, replay por cursor, `RESYNC_REQUIRED` para cursor fora do buffer e heartbeat/limpeza de peers

## 3. Servidor: cobertura de eventos e payloads aplicáveis

- [x] 3.1 Corrigir payloads que hoje são no-op no cliente: archive/unarchive de item (`apps/api/src/routes/items.ts:1221,1262`) incluem `itemIds`; reorder (`items.ts:169`) inclui `itemIds`/`columnId` tratáveis como invalidação
- [x] 3.2 Emitir `PROJECT_METADATA_CHANGED` nas mutações de colunas (`routes/columns.ts`), tags (`routes/tags.ts`) e versões (`routes/versions.ts`); anexos (`routes/attachments.ts`) emitem `ITEM_UPDATED` com `itemIds` (detalhe do item, decisão 7 do design)
- [x] 3.3 Emitir `PROJECT_METADATA_CHANGED` nas mutações de metadados em `routes/projects.ts` (módulos editados/excluídos, membros, squads, centros de custo, configurações do projeto)
- [x] 3.4 Emitir `ITEM_UPDATED` (com `itemId`) nas mutações mudas de detalhe do item: tags do item, atribuição de sprint, work-log e logs (`routes/items.ts`)
- [x] 3.5 Emitir `SPRINT_CHANGED` de fato nas rotas de sprint (`routes/sprints.ts`: CRUD, ativar, abrir, fechar), cobrindo a exigência da spec `realtime-sync`
- [x] 3.6 Testes de cobertura: toda rota de mutação emite evento; nenhum tipo do contrato fica sem emissor

## 4. Cliente: hook com cursor, backoff, heartbeat e estados honestos

- [x] 4.1 Reescrever `apps/web/src/hooks/useWebSocket.ts`: cursor da última `sequence` aplicada enviado como `since` no handshake; backoff exponencial persistente entre tentativas (1s → máx. 30s, reset só após conexão estável); handler de `REPLAY_COMPLETE`/`RESYNC_REQUIRED`
- [x] 4.2 Heartbeat do cliente: rastrear `lastMessageAt`, tratar 2× o intervalo sem mensagens como conexão zumbi (fechar e reconectar); mensagens `HEARTBEAT` não tocam estado de dados
- [x] 4.3 Máquina de estados `connecting → syncing → synced | offline`: `synced` só após `REPLAY_COMPLETE` e conclusão do callback `onResync` registrado pelas telas; expor `onResync` na assinatura do hook
- [x] 4.4 Testes do hook: backoff crescente sem reset por tentativa, transições de estado, zumbi dispara reconexão, `synced` só pós-reconciliação

## 5. Cliente: telas, reducer e textos

- [x] 5.1 Atualizar `apps/web/src/lib/realtimeEvents.ts`: separar `BOARD_PATCH_EVENT_TYPES` (patch incremental) de `BOARD_INVALIDATE_EVENT_TYPES` (refetch do board — reorder e metadados), tratar `PROJECT_METADATA_CHANGED` por seção; remover tipos legados
- [x] 5.2 Atualizar o reducer `applyBoardEvent` (`features/board/hooks/useBoardData.ts`) para aplicar `itemIds` de archive/unarchive e desconhecer apenas tipos fora do contrato; registrar `onResync` do board (substituindo o `wasOfflineRef` por callback explícito quando aplicável)
- [x] 5.3 Ligar `onResync`/estado honesto em Dashboard (`pages/ProjectDashboardPage.tsx`) e Settings (`features/project-settings/ProjectSettingsScreen.tsx`), incluindo invalidação por seção de `PROJECT_METADATA_CHANGED`
- [x] 5.4 UI honesta: `components/BoardContext.tsx`, `features/board/BoardScreen.tsx` e `pages/ProjectDashboardPage.tsx` exibem `connecting/syncing/synced/offline`, com "Sincronizado" apenas pós-reconciliação; atualizar i18n `apps/web/src/i18n/locales/{pt-BR,en,es}/board.json` e `dashboard.json` (novo estado "Sincronizando" e revisão de "Atualizações em tempo real")
- [x] 5.5 Preservar os testes existentes (`realtimeCache.test.ts`, `realtimeEvents.test.ts`, contratos do Item 17 e continuação) e cobrir o reducer atualizado

## 6. Verificação e documentação

- [x] 6.1 `bun run check` e `bun run test:smoke` sem regressões; validação manual de queda de rede (replay em queda curta, ressincronização em queda longa, zumbi)
- [x] 6.2 Atualizar `docs/ANALISE-SISTEMA.md` (item 20: registrar resolvido com as limitações de buffer em memória) e `docs/azyboard-wiki/04 - Board e Visualizacoes/Sincronizacao em Tempo Real.md` (replay, heartbeat, estados honestos)
- [x] 6.3 Registrar `Board ref: bf602847-203b-41ba-ad7d-fff932c28e86` nos artefatos da change e concluir o card com `complete_task` após a verificação final
