## Context

O runtime atual usa Bun, SQLite e Drizzle. O schema declara `text` para timestamps e várias colunas usam `default(new Date().toISOString())`; esse valor é calculado quando `schema.ts` é importado. A migration 0021 reconstruiu tabelas e gravou esses valores calculados como defaults literais no DDL, portanto o problema existe tanto no código-fonte quanto nas bases já migradas.

A aplicação normalmente preenche timestamps explicitamente nos casos de uso, mas defaults continuam sendo uma proteção importante para inserts incompletos, scripts e futuras rotas. O formato atual é ISO UTC com `T`, frações de segundo e `Z`, e é usado em ordenação, analytics e respostas da API.

## Goals / Non-Goals

**Goals:**

- Garantir que cada insert que dependa de default receba o instante da própria inserção.
- Remover todos os `default(new Date().toISOString())` do schema.
- Corrigir os defaults SQLite materializados em tabelas existentes sem reescrever valores históricos.
- Preservar o formato ISO UTC compatível com os dados e consultas atuais.
- Validar o comportamento em base vazia, base legada, inserções via Drizzle e inserções SQL diretas.
- Deixar documentada a equivalência para PostgreSQL.

**Non-Goals:**

- Migrar SQLite para PostgreSQL ou trocar `text` por tipos temporais PostgreSQL neste change.
- Alterar timestamps explicitamente informados pela aplicação.
- Backfill ou correção de timestamps históricos já congelados.
- Criar um mecanismo automático para atualizar `updated_at` em todo UPDATE; a aplicação continua responsável por isso.
- Alterar contratos HTTP ou o formato das respostas.

## Decisions

- **Usar default SQL dinâmico compatível com ISO no SQLite.** O schema usará uma expressão SQLite equivalente a `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`, em vez de um literal JavaScript. Isso protege também inserts SQL diretos e mantém o formato temporal atual. Alternativa considerada: `$defaultFn(() => new Date().toISOString())`; rejeitada como solução única porque só cobre inserts que passam pelo Drizzle e não corrige o default físico da base.
- **Aplicar a mesma expressão na migration.** Como SQLite não permite alterar diretamente o default de uma coluna, a migration reconstruirá apenas as tabelas que possuem defaults temporais congelados, copiando todas as colunas e recriando índices, chaves e constraints. A migration não atualizará os valores já existentes.
- **Cobrir somente defaults temporais congeláveis.** Serão corrigidas as colunas `created_at`/`updated_at` que hoje usam o default literal: `tenants`, `users`, `api_keys`, `projects`, `squads`, `project_cost_centers`, `memberships`, `sprints`, `items`, `attachments` e `checklists`. Colunas temporais `NOT NULL` sem default continuam exigindo preenchimento explícito.
- **Usar precisão de milissegundos no formato UTC.** A expressão SQLite produz `YYYY-MM-DDTHH:MM:SS.SSSZ`, evitando a mistura entre `CURRENT_TIMESTAMP` (`YYYY-MM-DD HH:MM:SS`) e os valores ISO existentes. No PostgreSQL futuro, o ponto equivalente será `TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`, com conversão de apresentação para ISO na borda quando necessário.
- **Manter migrations append-only e idempotentes pelo runner.** A nova migration será aplicada uma vez pelo journal; seus testes executarão o fluxo completo de migration em bases vazia e populada e verificarão que uma segunda execução não altera dados.
- **Preservar a topologia atual das tabelas.** O rebuild deve manter FKs, índices, checks, unicidades e nomes existentes, especialmente as constraints introduzidas pela migration 0021. A alteração é de default, não de semântica de relacionamento.

## Risks / Trade-offs

- **Rebuild de várias tabelas pode prolongar o deploy SQLite** → fazer backup antes da migration, executar dentro do fluxo transacional existente e medir/validar contagens e `PRAGMA foreign_key_check`.
- **Precisão temporal depende do relógio do host** → usar UTC gerado pelo SQLite e não alterar timestamps históricos; observabilidade de relógio fica fora deste change.
- **Incompatibilidade futura com PostgreSQL** → documentar explicitamente o DDL equivalente e manter a expressão isolada como ponto `[DB-SWAP]` no schema/migration.
- **Duas inserções muito próximas podem compartilhar o mesmo milissegundo** → o requisito é não reutilizar o timestamp de carregamento do schema; ordenação determinística adicional deve usar o ID/sequence quando necessário.
- **Rebuild pode perder algum índice ou constraint por omissão** → comparar `PRAGMA table_info`, `foreign_key_list` e `index_list` antes/depois e manter testes de integridade existentes verdes.

## Migration Plan

1. Inventariar defaults temporais físicos no schema de uma base recém-migrada e no backup representativo do LabApps.
2. Atualizar `schema.ts` para o default SQL dinâmico e adicionar comentários `[DB-SWAP]` onde a expressão SQLite divergir do PostgreSQL.
3. Criar migration para reconstruir as tabelas afetadas, preservando dados, índices e constraints, com default temporal dinâmico.
4. Testar inserts omitindo timestamps via Drizzle e SQL, além de verificar que linhas históricas não mudaram.
5. Rodar typecheck, testes de migration/integridade, build e smoke test.
6. Fazer backup do banco do LabApps, aplicar a migration, validar defaults, contagens, `foreign_key_check` e logs da aplicação.

Rollback: restaurar o backup do banco e reverter a aplicação para o commit anterior. Como SQLite não oferece rollback simples de alteração de default, a restauração do backup é o procedimento de produção.

## Open Questions

- Confirmar durante a implementação se `strftime` é aceito de forma idêntica pelo Bun SQLite e pelo Drizzle no default declarativo; se não for, manter a expressão no DDL da migration e usar `$defaultFn` no schema como fallback documentado.
- Confirmar se a ferramenta de snapshot do Drizzle deve registrar a expressão dinâmica ou se a migration manual precisa permanecer como fonte de controle, como ocorreu na migration 0021.
