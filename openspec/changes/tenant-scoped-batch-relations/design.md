## Context

Em `apps/api/src/routes/batch.ts`, a atualização por filtros carrega `projectItems`, catálogos do projeto e usuários do tenant, mas também executa `db.select().from(itemSprints)` e `db.select().from(itemTags)` sem filtro. Depois, `matched` usa `some()` em memória para sprint/tag. O banco já possui `tenant_id` nas duas tabelas, FKs compostas para itens e índices/uniqueness das relações; a correção deve aproveitar esse modelo.

O resultado do batch deve continuar igual: itens ativos selecionados pelos filtros, mudanças aplicadas na transação, relações de sprint/tag atualizadas quando solicitadas, respostas por item e comportamento `atomic` inalterados. A consulta não pode depender de IDs vindos de outro tenant.

## Goals / Non-Goals

**Goals:**

- Nunca carregar relações de sprint/tag fora do tenant/projeto/conjunto de itens em processamento.
- Fazer a seleção de itens e a existência das relações no banco, reduzindo memória e tempo com tabelas globais.
- Preservar filtros por sprint e tag, inclusive nomes/IDs resolvidos e `onlyLeaves`.
- Cobrir anti-IDOR com dados homônimos/IDs iguais em tenants diferentes.
- Medir o plano de consulta e adicionar índice apenas se a evidência justificar.

**Non-Goals:**

- Reescrever todo o executor batch ou alterar o contrato HTTP/MCP.
- Migrar tags/sprints para outro modelo ou remover `tenant_id` das relações.
- Alterar regras de autorização, limites, idempotência ou atomicidade.
- Otimizar outras relações não utilizadas pelos filtros de batch nesta tarefa.

## Decisions

### IDs de relações selecionados pelo banco

Depois de resolver os recursos do projeto, buscar somente os pares necessários com joins limitados aos itens do projeto e `tenant_id`:

- `item_sprints`: selecionar `item_id,sprint_id` com `item_sprints.tenant_id = ctx.tenantId`, `items.project_id = projectId` e `items.tenant_id = ctx.tenantId`.
- `item_tags`: aplicar a mesma restrição, incluindo `item_tags.tenant_id`.

Como `matched` já é calculado sobre `projectItems`, a implementação pode construir mapas somente com esses pares e manter o restante do algoritmo. Alternativamente, o filtro pode usar `EXISTS`; a escolha final deve privilegiar uma única consulta parametrizada por relação e não uma consulta por item.

Alternativa rejeitada: carregar as tabelas inteiras e filtrar em JavaScript — é precisamente a regressão do Item 15.

### Escopo e projeto como invariantes

O filtro de relações SHALL sempre conter `tenant_id` e a relação com `items` do `projectId`. Não confiar somente em `tagId`/`sprintId`, pois IDs e relações são dados não confiáveis e podem ser cruzados entre tenants em bases legadas.

### Índices

Primeiro usar os FKs/índices existentes e validar com testes de consulta. Se o plano ainda fizer scan relevante, adicionar índice append-only composto com a ordem de predicados (`tenant_id,item_id,sprint_id` e equivalente para tags), preservando as constraints atuais. [DB-SWAP] No PostgreSQL validar `EXPLAIN (ANALYZE, BUFFERS)` e considerar índice parcial para itens ativos somente se houver ganho medido.

## Risks / Trade-offs

- [Join com itens] Uma consulta pode retornar pares duplicados se houver dados legados duplicados → `Set`/mapa deduplicado e teste de unicidade existente.
- [Filtro semanticamente diferente] IDs de tags/sprints válidos do projeto, mas sem item selecionado, podem deixar de influenciar `matched` → testes de paridade cobrem filtro com relação e sem relação.
- [Base legada cross-tenant] Relações inválidas podem existir antes da correção → consulta exige ambos os tenant_ids e auditoria continua reportando resíduos.
- [Quantidade grande de IDs] `IN` direto pode atingir limite do SQLite → preferir joins por tabela/consulta sem montar `IN` global; se necessário, paginar IDs em lotes limitados.

## Migration Plan

1. Implementar a consulta tenant-scoped sem migration se os índices existentes forem suficientes.
2. Rodar testes de integração em base vazia, base com relações de dois tenants e base populada grande.
3. Se houver índice novo, adicionar migration append-only com guard `PRAGMA foreign_key_check` e testar reexecução.
4. Fazer deploy sem alteração de payload; validar batch por REST/MCP e logs de consulta.
5. Rollback: reverter a aplicação; se houver índice, mantê-lo (é aditivo e compatível).

## Open Questions

- O filtro por `tag`/`sprint` precisa incluir itens arquivados para alguma integração legada, ou o conjunto ativo atual é o contrato definitivo?
