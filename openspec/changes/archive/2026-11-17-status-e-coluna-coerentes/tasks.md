# Tasks

## 1. Reconciliação no caso de uso

- [x] 1.1 Criar `reconcileStatusAndColumn` em `application/items.ts`, com as regras de status → coluna, coluna → status e status sem coluna.
- [x] 1.2 Aplicar a reconciliação em `updateItemApplication` antes de montar o patch, incluindo o payload do evento em tempo real.

## 2. Testes

- [x] 2.1 Regressão: card no Backlog com status `IN_PROGRESS` passa para a primeira coluna em andamento.
- [x] 2.2 Cobertura de `NOT_STARTED`, coluna sem status, status e coluna juntos e status sem coluna.

## 3. Verificação e documentação

- [ ] 3.1 Rodar `bun run check` (typecheck + lint + testes + build).
- [x] 3.2 Validar `bun run openspec:validate` e `bun run check:docs`.
- [x] 3.3 Criar a change OpenSpec com proposal, design, tasks e delta de `card-management`.