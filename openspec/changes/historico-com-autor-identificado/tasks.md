# Tasks

## 1. API — leitura dos logs

- [x] 1.1 Fazer `mapItemLog` aceitar o autor e montar `{ id, name, avatarUrl }`, como no adapter SQLite.
- [x] 1.2 Juntar `users` em `listItemLogs` com `LEFT JOIN` por `tenant_id`/`id` e qualificar as condições com `l.`.
- [x] 1.3 Fazer o mesmo em `getItemLog`.
- [x] 1.4 Gravar `actor_type`, `actor_source` e `actor_label` no apontamento manual criado por API key (MCP), como já ocorre nas mutações do card.

## 2. Web — identidade do autor

- [x] 2.1 Criar `LogActor` compartilhado com menção `@Nome` (T76), rótulo de agente, Sistema e fallback "Autor não identificado".
- [x] 2.2 Usar o componente e `logActorLabels` no `ActivityLogPanel`.
- [x] 2.3 Usar o componente e `logActorLabels` no `WorkLogPanel`.
- [x] 2.4 Expor `actorType`, `actorLabel` e `source` no contrato `WorkLog`.
- [x] 2.5 Adicionar `accordion.unknown` e `accordion.unidentifiedAuthor` em pt-BR, en e es.

## 3. Testes

- [x] 3.1 Paridade PostgreSQL: autor hidratado e log sem autor em `listItemLogs`/`getItemLog`.
- [x] 3.2 Cobrir auditoria e diário com autor resolvido no teste de integração, inclusive apontamento criado por API key.
- [x] 3.3 Teste de componente do `LogActor` (humano, sem autor, agente, sistema, desconhecido, T76).
- [x] 3.4 Atualizar o contrato estrutural dos painéis de histórico e diário.
- [x] 3.5 Rodar `bun run typecheck`, `bun run lint`, `bun run build`, `bun run check:docs`, `bun run check:i18n` e `bun run openspec:validate`.

## 4. Documentação

- [x] 4.1 Atualizar a wiki "Histórico de Atividades e Tempo Trabalhado" com a identificação do autor e o fallback.

## 5. Card

- [x] 5.1 Registrar `Board ref: 228e7141-e724-467d-8a55-ff81c960a695` nos artefatos da change.
- [x] 5.2 Fechar o card com `complete_task` e registrar o consumo de tokens.
