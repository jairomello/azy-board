## 1. Inventário e Saneamento

- [x] 1.1 Criar consulta de auditoria que lista órfãos, duplicatas e vínculos cross-tenant por tabela.
- [x] 1.2 Rodar a auditoria no banco local e no backup do LabApps e registrar o volume de violações.
- [x] 1.3 Definir regras determinísticas de saneamento (papel de membership, e-mail canônico, tag/associação canônica).
- [x] 1.4 Escrever a migration de saneamento com backup lógico e relatório do que foi alterado.

## 2. Schema Drizzle

- [x] 2.1 Adicionar `UNIQUE (tenant_id, id)` nas tabelas pai que sustentam FKs compostas.
- [x] 2.2 Declarar FKs compostas com `tenant_id` em `items`, `projects`, `memberships`, `item_tags`, `item_sprints`, `attachments`, `checklists`, `item_logs`, `modules`, `columns`, `sprints`, `squads` e `project_cost_centers`.
- [x] 2.3 Adicionar auto-FK composta de `items.parent_id` e FKs de `projects.manager_user_id` e `projects.simple_story_id`, com `NO ACTION` (sem `ON DELETE CASCADE`).
- [x] 2.4 Adicionar unicidade de e-mail por tenant em `users`, `UNIQUE (tenant_id, project_id, user_id)` em `memberships` e `PRIMARY KEY (item_id, tag_id)` em `item_tags`.
- [x] 2.5 Adicionar `CHECK` de não-negatividade e ordem de datas em `items`, `sprints` e `projects`.
- [x] 2.6 Atualizar snapshot/journal do Drizzle e garantir typecheck do schema.

## 3. Migration de Reconstrução

- [x] 3.1 Escrever a migration SQL de rebuild das tabelas afetadas usando o procedimento de 12 passos do SQLite.
- [x] 3.2 Recriar todos os índices e recriar a PK/unicidade das tabelas reconstruídas.
- [x] 3.3 Executar `PRAGMA foreign_key_check` e falhar a migration se houver violação residual.
- [x] 3.4 Garantir idempotência: rodar a migration duas vezes em base vazia e em base populada sem erro.
- [x] 3.5 Cobrir a migration com teste que simula base legada (incluindo dados inválidos) e valida o resultado.

## 4. Aplicação e Tratamento de Erros

- [x] 4.1 Mapear erros de constraint do SQLite/PostgreSQL para `CONFLICT` (409) e `INVALID_REQUEST` (422) no middleware de erro.
- [x] 4.2 Revisar rotas de criação/atualização de usuário, membro, item, tag, sprint e projeto para retornarem conflito de domínio em vez de 500.
- [x] 4.3 Ajustar normalização de e-mail no cadastro/login para casar com a unicidade do banco.
- [x] 4.4 Garantir a exclusão de subárvore com FKs `NO ACTION`: exclusão explícita dos filhos antes do pai, com teste de exclusão de item com filhos.

## 5. Testes e Verificação

- [x] 5.1 Adicionar suíte de integridade que verifica ausência de órfãos e duplicatas após operações típicas.
- [x] 5.2 Adicionar testes que comprovam rejeição de cross-tenant, e-mail duplicado, membership duplicado e valores negativos.
- [x] 5.3 Executar typecheck, testes de migration/integração/MCP, build e smoke test.
- [x] 5.4 Validar a equivalência da modelagem para PostgreSQL e documentar o DDL equivalente (sem RLS).

## 6. Entrega

- [x] 6.1 Documentar a política de integridade e o procedimento de saneamento/rollback.
- [ ] 6.2 Fazer backup do banco do LabApps antes do deploy e registrar como restaurar.
- [ ] 6.3 Emitir o relatório de saneamento em log JSON e arquivar o stdout da migration em `data/backups/sanitization-<timestamp>.log`.
- [ ] 6.4 Aplicar a migration no LabApps, validar `foreign_key_check` e confirmar smoke test verde.
