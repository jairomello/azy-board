# Tasks — criar card pelo Teams

## 1. Banco e portas

- [ ] 1.1 Migration SQLite `0057_teams_card_creation.sql` com `project_integrations` e `integration_messages`.
- [ ] 1.2 Migration PostgreSQL equivalente (`0032_teams_card_creation.sql`), com índices e `unique`.
- [ ] 1.3 Schema Drizzle (SQLite e PostgreSQL) e tipos em `persistence/models.ts`.
- [ ] 1.4 Porta `integrations` (criar/ler/atualizar por projeto, resolver por token público, registrar mensagem, dedup, rate limit).

## 2. Endpoint público

- [ ] 2.1 `POST /api/integrations/teams/messages/:token` fora do middleware de sessão.
- [ ] 2.2 Validar HMAC-SHA256 com o segredo do Teams; 401 quando inválido.
- [ ] 2.3 Limitar corpo (32 KB), exigir JSON e responder 404 para token inválido/inativo.
- [ ] 2.4 Deduplicar pelo id da mensagem e devolver o mesmo card.
- [ ] 2.5 Aplicar rate limit por integração com `Retry-After`.

## 3. Interpretação e criação

- [ ] 3.1 Remover a menção e interpretar `criar <título>` com campos opcionais (`tipo`, `prazo`, `responsável`).
- [ ] 3.2 Criar `TASK`/`BUG` na coluna configurada com `externalSource = 'TEAMS'` e `externalRef` da mensagem.
- [ ] 3.3 Autor como `assigneeLabel` e registro do remetente no log do card.
- [ ] 3.4 Resposta com link do card; erro legível para comando inválido.

## 4. Configuração (ADMIN)

- [ ] 4.1 `GET/PUT/DELETE /projects/:projectId/integrations/teams` com URL montada a partir do token público e segredo mascarado.
- [ ] 4.2 Gerar/rotacionar token público e coluna inicial.
- [ ] 4.3 Exibir últimas mensagens recebidas com resultado (criado, ignorado, erro).
- [ ] 4.4 RBAC: VIEWER/MEMBER 403; outro tenant responde como inexistente.

## 5. UI

- [ ] 5.1 Seção “Integrações” nas configurações do projeto (ADMIN).
- [ ] 5.2 URL para colar no Teams, campo do segredo, coluna inicial e ativar/desativar.
- [ ] 5.3 Lista das últimas mensagens com link do card criado.
- [ ] 5.4 Textos em pt-BR, en e es.

## 6. Verificação

- [ ] 6.1 Testes de HMAC (válido, inválido, ausente) e token desconhecido.
- [ ] 6.2 Testes de parse: comando válido, sem `criar`, título vazio, campos opcionais.
- [ ] 6.3 Teste de dedup: mesma mensagem duas vezes gera um card.
- [ ] 6.4 Teste de rate limit e de RBAC.
- [ ] 6.5 Teste funcional com canal real do Teams via túnel (fecha o E5).
- [ ] 6.6 `typecheck`, `lint`, `check:i18n`, `check:persistence`, `check:api-boundary`, `check:bundle` e `build`.
- [ ] 6.7 Suíte sem falha nova e rodada ADVANCED contra PostgreSQL e Valkey.

## 7. Documentação

- [ ] 7.1 CHANGELOG e wiki (como configurar e usar o `@Azy criar`).
- [ ] 7.2 `openspec validate` e `check:docs` verdes.
- [ ] 7.3 Evidência do E5 em `docs/azyboard/evidencias/`.

## Fora da v1

- Notificação de saída (Azy → Teams).
- Bot/message extension com cartões interativos.
- Mapeamento do autor por e-mail via Microsoft Graph.
- Criação em lote e comandos de atualização (`mover`, `concluir`).
