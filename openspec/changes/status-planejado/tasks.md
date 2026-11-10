# Tasks

## 1. Domínio

- [x] 1.1 Adicionar `PLANNED` a `TaskStatus` e `ColumnBaseStatus` em `packages/domain/src/index.ts`.
- [x] 1.2 Documentar em `progress.ts` que `PLANNED` vale 0 e não participa da faixa do fluxo.

## 2. Banco e persistência

- [x] 2.1 Adicionar `PLANNED` aos enums do schema SQLite e aos checks do schema PostgreSQL (colunas, status e status anterior ao arquivamento).
- [x] 2.2 Criar a migration PostgreSQL `0030_status_planned.sql` recriando os três CHECKs.
- [x] 2.3 Alinhar `release` ao `baseStatus` da coluna nos adapters SQLite e PostgreSQL.
- [x] 2.4 Incluir `PLANNED` nas consultas de candidatos da transição de sprint.

## 3. API

- [x] 3.1 Incluir `PLANNED` nos enums de criação, edição, filtro e lote em `validation.ts`, `batch.ts` e `sprintTransition.ts`.
- [x] 3.2 Permitir `PLANNED` e os demais status já documentados como `baseStatus` de coluna.
- [x] 3.3 Incluir `PLANNED` no escopo padrão de gaps de planejamento e na distribuição do dashboard.
- [x] 3.4 Atualizar a instrução de priorização do assistente para aceitar `PLANNED` fora do `Backlog`.

## 4. MCP

- [x] 4.1 Declarar `baseStatus` com enum explícito no catálogo e atualizar as descrições de `create_column` e `prepare_sprint_transition`.
- [x] 4.2 Incluir `PLANNED` nos enums de `create_task`, `update_item`, `update_items`, filtros e validação do catálogo.
- [x] 4.3 Corrigir `toolCreateColumn` para enviar apenas `name` e `baseStatus` no corpo.

## 4b. Troca de status base de coluna existente

- [x] 4b.1 Propagar o novo status aos cards sincronizados na troca de `baseStatus` (SQLite e PostgreSQL), preservando status divergente.
- [x] 4b.2 Expor a troca de status base no seletor da tela de configurações da coluna.

## 5. Web

- [x] 5.1 Adicionar rótulos `PLANNED` em pt-BR, en e es (`board` e `common`).
- [x] 5.2 Incluir `PLANNED` nos valores do filtro, nos chips de filtro ativo, na grade da árvore e no seletor de status base da coluna.

## 6. Documentação

- [x] 6.1 Atualizar a wiki (tipos/status, modelo de projeto e gerenciamento de colunas).
- [x] 6.2 Atualizar a skill oficial (`SKILL.md` e `mcp-operations.md`).
- [x] 6.3 Regenerar os artefatos de documentação (`bun run generate:docs`) e revisar o diff.

## 7. Verificação

- [x] 7.1 Testes de unidade do domínio para peso 0 de `PLANNED`.
- [x] 7.2 Testes de integração: criar coluna `PLANNED`, mover card e conferir status; `release` preservando o status da coluna.
- [x] 7.3 Teste de regressão do `create_column` via MCP.
- [x] 7.4 `bun run test:agent-skill` verde; `typecheck`, `lint`, `check:persistence`, `check:api-boundary` e `build` verdes. A suíte completa mantém 15 falhas pré-existentes em `memberCandidates`/`users-list` (SQLite `parser stack overflow` no Bun 1.4.4 local; a mesma falha ocorre sem este change).
