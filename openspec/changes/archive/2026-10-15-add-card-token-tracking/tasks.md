# Tasks

## 1. Dados e migrações

- [x] 1.1 Adicionar `tokensInput` e `tokensOutput` (INTEGER anulável) à tabela `items` em `apps/api/src/db/schema.ts` e `apps/api/src/db/postgres/schema.ts`, com check `>= 0` no schema Drizzle/PG; verificar com `bun run typecheck` e `bun run test:migrations`
- [x] 1.2 Criar as migrations aditivas `apps/api/src/db/migrations/0052_*.sql` (SQLite) e `apps/api/src/db/postgres/migrations/0025_*.sql` (PG) adicionando as duas colunas; registrar no `_journal.json` (SQLite) e confirmar que o runner PG aplica por ordem lexical (`parity.test.ts`)
- [x] 1.3 Adicionar invariante de tokens negativos em `apps/api/src/db/integrity.ts` (análogo a `negative_points`) e verificar com `bun run test:migrations`
- [x] 1.4 Estender `ItemRecord` (`apps/api/src/persistence/models.ts`) e os mapeamentos/inserts do SQLite (`db/sqlite/itemUnitOfWork.ts`) e PostgreSQL (`db/postgres/adapter.ts`) para ler/gravar tokens; verificar com os testes de unidade de item existentes

## 2. API REST

- [x] 2.1 Aceitar `tokensInput`/`tokensOutput` em `createItemSchema`/`updateItemSchema` (`apps/api/src/validation.ts`) com validação de inteiro não-negativo; verificar com testes de schema
- [x] 2.2 Persistir e auditar tokens em `createItemApplication`/`updateItemApplication` (`apps/api/src/application/items.ts`), incluindo tokens em `writableFields`, `loggableFields` e `labels`; verificar que a alteração gera evento automático
- [x] 2.3 Expor tokens e total derivado nas respostas e na projeção de listagem (`apps/api/src/routes/items.ts`), e aceitar tokens no endpoint de lote `POST /items/update` (`apps/api/src/routes/batch.ts`: `allowedFields`, `labels`, conversão e validação); verificar com testes de rota
- [x] 2.4 Criar o endpoint de registro massivo de tokens (uma chamada, vários cards, atômico por item, falhas por entrada) reutilizando os padrões de isolamento tenant/projeto; verificar com teste de rota cobrindo lote válido e lote com item inválido

## 3. Catálogo MCP e execução

- [x] 3.1 Declarar `tokensInput`/`tokensOutput` no enum de `itemChangeSchema`, em `schemaFor`, em `toolFields` (`update_item`/`update_items`), na projeção `PROJECTION_FIELDS` e na allowlist/clearable de `packages/tool-registry/src/{registry,fields,validation}.ts`; verificar com `registry-contract.test.ts` e `optional-fields.test.ts`
- [x] 3.2 Declarar a ferramenta `set_item_tokens` no descritor único (schema, validação, policy `write`, classificação `evidence/item/update`, forma de resposta e descoberta); verificar com teste de contrato do catálogo
- [x] 3.3 Implementar a execução de `set_item_tokens` em `packages/tool-execution` (adapter HTTP para o endpoint de lote), com erro por item; verificar com teste do adapter
- [x] 3.4 Adicionar o aviso não bloqueante de tokens ausentes à resposta de `complete_task` (descritor + execução) quando houver indício de execução por agente; verificar com teste de contrato da resposta
- [x] 3.5 Documentar `set_item_tokens`, os novos campos de token e o aviso de `complete_task` em `apps/mcp/README.md`; verificar com `bun run test:agent-skill`

## 4. Web

- [x] 4.1 Adicionar tokens aos tipos do item (`packages/ui-contracts` `Card`/`toCard`, `CardData`, `ItemData`, `FullItemData`); verificar com `bun run typecheck`
- [x] 4.2 Exibir o total de tokens no card do Kanban (`apps/web/src/components/KanbanCard.tsx`) apenas quando houver valor, preservando o layout; verificar com `kanban-card-layout-contract.test.ts`
- [x] 4.3 Exibir e editar tokens de entrada/saída na área de planejamento do modal (`apps/web/src/components/ItemModal.tsx`), com total calculado, modo leitura para VIEWER e vazio salvo como nulo; verificar com `bun run typecheck` e teste do modal

## 5. Skill e documentação

- [x] 5.1 Atualizar `skills/azyboard/SKILL.md` (e o espelho `.opencode/skills/azyboard/SKILL.md`) com o passo de registrar tokens ao concluir e o aviso do `complete_task`; verificar com `bun run test:agent-skill`
- [x] 5.2 Documentar em `skills/azyboard/references/` o roteiro de backfill massivo (ler logs de sessão do harness, mapear por card, confirmar ambíguos, enviar um lote por `set_item_tokens`), com exemplos mínimos; verificar com `bun run test:agent-skill`
- [x] 5.3 Atualizar a documentação do produto (`docs/azyboard-wiki`: Anatomia do Card e Pontos/Progresso) mencionando o campo de tokens; verificar leitura dos arquivos alterados

## 6. Verificação integrada

- [x] 6.1 Rodar `bun run check` (typecheck + lint + persistência + boundary + testes + build) e corrigir regressões de contrato
- [x] 6.2 Rodar `bun run test:smoke` no fluxo web/API e `bun run test:agent-skill`, confirmando o fluxo de registro e exibição de tokens

## Workflow follow-up

- Arquivar a change após a revisão, sem encerrar o card: lembrar de fechar o card T77 no board com `complete_task` e confirmar `status = DONE`.
