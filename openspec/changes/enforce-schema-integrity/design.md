## Context

O runtime usa SQLite (Bun + Drizzle) em dev e produção no LabApps; PostgreSQL ainda não foi adotado (Item 9 permanece em decisão). `migrate.ts` já executa com `PRAGMA foreign_keys = OFF` durante as migrations e reativa ao final, mas o schema não declara FKs nem unicidade para grande parte das invariantes. O resultado é que a integridade depende de filtros `tenant_id` espalhados por rotas e serviços.

A análise em `docs/ANALISE-SISTEMA.md` (Item 10) lista os gaps e recomenda chaves compostas com tenant, unicidade por tenant/e-mail e membros, PK nas relações N:N, FK de hierarquia e constraints de datas/números. O roteiro priorizado coloca "reforçar constraints e índices" na Fase 1, antes da migração para PostgreSQL.

## Goals / Non-Goals

**Goals:**

- Tornar cross-tenant, duplicatas e órfãos impossíveis pela camada de banco, não só pela aplicação.
- Preservar todos os dados válidos existentes durante a migração; saneamento determinístico e auditável.
- Manter a aplicação funcionando com SQLite e sem regressão nos fluxos atuais.
- Deixar a base pronta para que a migração a PostgreSQL (Item 9) só precise trocar o dialeto e, opcionalmente, adicionar RLS.

**Non-Goals:**

- Migrar para PostgreSQL ou implementar RLS agora.
- Substituir a validação de entrada em runtime (Item 7), o contrato de erro já entregue (Item 8) ou a refatoração de cascata/outbox (Item 12).
- Redesenhar a árvore com uma tabela closure dedicada; a auto-FK composta cobre o requisito atual.
- Alterar permissões, papéis ou semântica de negócio.

## Decisions

- **FK composta com `tenant_id` como padrão de isolamento no banco.** Para cada relação filho→pai, usar `FOREIGN KEY (tenant_id, parent_id) REFERENCES parent(tenant_id, id)`. Isso exige `UNIQUE (tenant_id, id)` no pai. Alternativa considerada: FK simples em `id`; rejeitada porque permite vínculo cross-tenant quando a aplicação falha.
- **Reconstrução de tabela no SQLite.** SQLite não permite `ALTER TABLE ADD CONSTRAINT`. A migration seguirá o procedimento de 12 passos: `PRAGMA foreign_keys=OFF` (já aplicado no runner), `PRAGMA legacy_alter_table=ON`, criar tabela nova com constraints, copiar dados, dropar original, renomear, recriar índices, validar com `PRAGMA foreign_key_check`, e restaurar pragmas. Alternativa considerada: apenas validar na aplicação; rejeitada por manter o problema.
- **Unicidade por chave natural, não por checksum.** `UNIQUE (tenant_id, lower(email))` em `users` (índice de expressão, suportado pelo SQLite) e `UNIQUE (tenant_id, project_id, user_id)` em `memberships`; `PRIMARY KEY (item_id, tag_id)` em `item_tags`. Alternativa considerada: coluna `normalized_email`; preterida por exigir denormalização e sincronização manual.
- **Saneamento antes das constraints.** A migration deduplica `memberships` mantendo a linha de maior papel (ADMIN > MEMBER > VIEWER) e a mais antiga; deduplica `item_tags`; normaliza e-mails e, em conflito de caixa, mantém o registro mais antigo; remove ou anula referências órfãs em `parent_id`, `manager_user_id`, `simple_story_id` e relações N:N. Cada correção é registrada em comentário e coberta por teste de migration.
- **Constraints de domínio no banco.** `CHECK` para `points >= 0`, `position >= 0`, `planned_points >= 0`, `planned_hours >= 0`, `end_date >= start_date` em `sprints` e `due_date >= start_date` em `items`. Alternativa considerada: só validação de aplicação; rejeitada por permitir corrupção via script/seed.
- **FKs de hierarquia com `NO ACTION`, sem `ON DELETE CASCADE`.** A FK serve apenas para rejeitar vínculo inexistente ou cross-tenant; a exclusão em cascata continua explícita na aplicação, que coleta descendentes e grava snapshot/eventos de analytics por item antes de apagar. Alternativa considerada: `CASCADE` no banco; adiada para o Item 12 porque moveria a política de cascata e o momento do snapshot para o banco, ampliando o escopo. Como a aplicação apaga o subárvore inteiro em uma única instrução `DELETE ... WHERE id IN (...)`, a checagem de FK é satisfeita ao fim do statement; ainda assim, a transação de exclusão usará `PRAGMA defer_foreign_keys = ON` (ou ordem por profundidade decrescente) como garantia, validada por teste.
- **E-mail canônico com `lower(trim(email))`.** O cadastro, login, setup e o saneamento normalizam o e-mail para `lower(trim(...))`; a unicidade por tenant é `UNIQUE (tenant_id, email)` sobre o valor canônico. O Drizzle/SQLite não gera índice por expressão (renderiza a expressão como identificador), então a canonicalização fica na aplicação, com efeito equivalente. Alternativa considerada: coluna `normalized_email`; preterida por exigir sincronização manual.
- **FKs circulares apenas na migration.** As FKs `items.parent_id` (auto-referência) e `projects.simple_story_id` → `items` não são declaradas em `schema.ts` porque criam inferência circular de tipos entre `projects` e `items`; são aplicadas na migration 0021 e cobertas por testes de integridade. Registro em `docs/db-integrity.md`.
- **Relatório de saneamento em log estruturado, arquivado no deploy.** A migration emite uma linha JSON por violação tratada (`{ tabela, tipo, quantidade, ação }`) e um resumo final. O procedimento de deploy captura o stdout da migration em `data/backups/sanitization-<timestamp>.log`, ao lado do backup do banco. Alternativa considerada: tabela de auditoria dedicada; preterida por adicionar uma tabela que entraria em cascatas, seed e manutenção sem necessidade de consulta transacional — se a consulta in-app for necessária depois, o relatório é promovido a tabela.
- **Mapeamento de erro.** O middleware de erro (já entregue) passará a reconhecer mensagens de constraint do SQLite/PostgreSQL e retornar `CONFLICT` (409) ou `INVALID_REQUEST` (422) com `retryable: false`, sem vazar SQL. Alternativa considerada: deixar virar 500; rejeitada por contrato e observabilidade.
- **Drizzle schema e snapshot.** Atualizar `schema.ts` com `references`, `uniqueIndex` e `check`, regerar mensagem/snapshot quando aplicável e escrever a migration à mão para controlar o rebuild. Alternativa considerada: `drizzle-kit generate`; usada como ponto de partida, mas o rebuild precisa de controle explícito.

## Risks / Trade-offs

- **Rebuild de tabelas grandes em SQLite** → executar em transação, medir tempo, fazer backup antes do deploy e validar `PRAGMA foreign_key_check` ao final; documentar janela de manutenção.
- **Dados legados violam as novas constraints** → saneamento determinístico, idempotente e testado contra uma base representativa; nunca truncar dados válidos silenciosamente.
- **Erros de constraint virarem 500** → adicionar mapeamento no middleware e testes de contrato.
- **Índices/ordem de rebuild quebrarem queries existentes** → recriar todos os índices e rodar suíte completa (integração, analytics, migration).
- **Divergência entre `schema.ts` e SQL** → teste que compara `PRAGMA foreign_key_list`/`index_list` com as expectativas declaradas na spec.
- **PostgreSQL futuro exigir ajuste** → manter nomes de constraint e semântica compatíveis; documentar o equivalente pg.

## Migration Plan

1. Inventariar dados potencialmente inválidos (órfãos, duplicatas, cross-tenant, negativos) em ambiente local e no backup do LabApps.
2. Atualizar `schema.ts` com FKs compostas, unicidade, PKs e checks.
3. Escrever a migration SQL de saneamento + reconstrução de tabelas, com `foreign_key_check` ao final.
4. Ajustar rotas/serviços e middleware para tratar conflitos de constraint como erros de domínio.
5. Adicionar testes de integridade, migration e integração; rodar typecheck, build e suíte completa.
6. Fazer backup do banco do LabApps, aplicar migration, validar contagens/`foreign_key_check` e smoke test.

Rollback: restaurar o backup do banco e reverter a aplicação para o commit anterior. Como as constraints são aditivas após saneamento, o rollback exige o backup, não uma migration reversa.

## Open Questions

- A ordem de exclusão em lote precisa de `PRAGMA defer_foreign_keys = ON` ou a ordenação por profundidade decrescente é suficiente no SQLite? Será decidido por teste durante a implementação.
- Confirmar se existe dado cross-tenant real no banco do LabApps; o volume define se o deploy precisa de janela estendida.
