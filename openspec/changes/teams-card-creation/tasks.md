# Tasks — criar card pelo Teams

## 1. Banco e portas

- [x] 1.1 Migration SQLite `0057_teams_card_creation.sql` com `project_integrations` e `integration_messages`.
- [x] 1.2 Migration PostgreSQL equivalente (`0032_teams_card_creation.sql`), com índices e `unique`.
- [x] 1.3 Schema Drizzle (SQLite e PostgreSQL) e tipos em `persistence/models.ts`.
- [x] 1.4 Porta `integrations` (criar/ler/atualizar por projeto, resolver por token público, registrar mensagem, dedup, rate limit).

## 2. Endpoint público

- [x] 2.1 `POST /api/integrations/teams/messages/:token` fora do middleware de sessão.
- [x] 2.2 Validar HMAC-SHA256 com o segredo do Teams; 401 quando inválido.
- [x] 2.3 Limitar corpo (32 KB), exigir JSON e responder 404 para token inválido/inativo.
- [x] 2.4 Deduplicar pelo id da mensagem e devolver o mesmo card.
- [x] 2.5 Aplicar rate limit por integração com `Retry-After`.

## 3. Interpretação e criação

- [x] 3.1 Remover a menção e interpretar `criar <título>; data inicio dd/mm/aa; data fim dd/mm/aa.` (com `|` e `tipo` aceitos por compatibilidade).
- [x] 3.2 Criar `TASK`/`BUG` na coluna configurada, no módulo `Backlog` sob a história `Entrada pelo Teams`, com `externalSource = 'TEAMS'` e `externalRef` da mensagem.
- [x] 3.3 Card sem responsável; nome de quem pediu registrado na descrição.
- [x] 3.4 Resposta com link do card; erro legível para comando inválido.

## 4. Configuração (ADMIN)

- [x] 4.1 `GET/PUT/DELETE /projects/:projectId/integrations/teams` com URL montada a partir do token público e segredo mascarado.
- [x] 4.2 Gerar/rotacionar token público e coluna inicial.
- [x] 4.3 Exibir últimas mensagens recebidas com resultado (criado, ignorado, erro).
- [x] 4.4 RBAC: VIEWER/MEMBER 403; outro tenant responde como inexistente.

## 5. UI

- [x] 5.1 Seção “Integrações” nas configurações do projeto (ADMIN).
- [x] 5.2 URL para colar no Teams, campo do segredo, coluna inicial e ativar/desativar.
- [x] 5.3 Lista das últimas mensagens com link do card criado.
- [x] 5.4 Textos em pt-BR, en e es.

## 6. Verificação

- [x] 6.1 Testes de HMAC (válido, inválido, ausente) e token desconhecido.
- [x] 6.2 Testes de parse: comando válido, sem `criar`, título vazio, campos opcionais.
- [x] 6.3 Teste de dedup: mesma mensagem duas vezes gera um card.
- [x] 6.4 Teste de rate limit e de RBAC.
- [x] 6.5 Teste funcional com canal real do Teams via túnel (fecha o E5).
- [x] 6.6 `typecheck`, `lint`, `check:i18n`, `check:persistence`, `check:api-boundary`, `check:bundle` e `build`.
- [x] 6.7 Suíte sem falha nova e rodada ADVANCED contra PostgreSQL e Valkey.

## 7. Documentação

- [x] 7.1 CHANGELOG e wiki (como configurar e usar o `@Azy criar`).
- [x] 7.2 `openspec validate` e `check:docs` verdes.
- [x] 7.3 Evidência do E5 em `docs/azyboard/evidencias/`.

## Fora da v1

- Notificação de saída (Azy → Teams).
- Bot/message extension com cartões interativos.
- Mapeamento do autor por e-mail via Microsoft Graph.
- Criação em lote e comandos de atualização (`mover`, `concluir`).
