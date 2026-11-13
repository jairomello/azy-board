# Tasks — link do card no Teams

## 1. Banco e portas

- [ ] 1.1 Migration SQLite `0057_project_integrations.sql` com `project_integrations` e `integration_deliveries`.
- [ ] 1.2 Migration PostgreSQL equivalente (`0032_project_integrations.sql`), com índices e `unique`.
- [ ] 1.3 Schema Drizzle (SQLite e PostgreSQL) e tipos em `persistence/models.ts`.
- [ ] 1.4 Porta `integrations` (get/upsert/delete por projeto, enqueue, claim de entregas, mark sent/failed) nos dois adapters.

## 2. API

- [ ] 2.1 `GET /projects/:projectId/integrations/teams` (ADMIN) com URL mascarada e contagem de falhas.
- [ ] 2.2 `PUT /projects/:projectId/integrations/teams` validando HTTPS e domínio do Teams.
- [ ] 2.3 `DELETE /projects/:projectId/integrations/teams`.
- [ ] 2.4 `POST /projects/:projectId/integrations/teams/test` enviando cartão de teste.
- [ ] 2.5 RBAC: VIEWER/MEMBER recebem 403; projeto de outro tenant responde como inexistente.

## 3. Entrega

- [ ] 3.1 Serviço de integração: montar o Adaptive Card e postar no webhook com timeout.
- [ ] 3.2 Enfileirar entrega para `ITEM_CREATED` a partir do dispatcher, sem bloquear a publicação no WebSocket.
- [ ] 3.3 Worker de entregas com backoff, limite de tentativas e marcação `FAILED`.
- [ ] 3.4 Deduplicação por `(integration_id, event_id)`.
- [ ] 3.5 Log e métrica de entregas (enviadas, falhas, pendentes).

## 4. UI

- [ ] 4.1 Seção “Integrações” nas configurações do projeto (ADMIN).
- [ ] 4.2 Campo de URL, ativar/desativar, “Enviar teste” e feedback de sucesso/erro.
- [ ] 4.3 Exibir falhas recentes sem revelar a URL completa.
- [ ] 4.4 Textos em pt-BR, en e es.

## 5. Verificação

- [ ] 5.1 Testes de API para CRUD, RBAC, validação de URL e teste.
- [ ] 5.2 Teste de enfileiramento e deduplicação a partir de `ITEM_CREATED`.
- [ ] 5.3 Teste do worker: sucesso, falha com retry e `FAILED` após o limite.
- [ ] 5.4 Teste funcional: criar card via MCP e conferir o link no canal de teste do Teams.
- [ ] 5.5 `typecheck`, `lint`, `check:i18n`, `check:persistence`, `check:api-boundary`, `check:bundle` e `build`.
- [ ] 5.6 Suíte sem falha nova e rodada ADVANCED contra PostgreSQL e Valkey.

## 6. Documentação

- [ ] 6.1 CHANGELOG e wiki (configurar integração do Teams).
- [ ] 6.2 `openspec validate` e `check:docs` verdes.
- [ ] 6.3 Evidência do E5 em `docs/azyboard/evidencias/F4-integracao.md` (ou arquivo próprio).

## Fora da v1

- Bot/message extension para criar card a partir de uma mensagem.
- Notificação de mudança de status e comentários no thread.
- Assinatura HMAC de saída (o Incoming Webhook do Teams não valida assinatura).
