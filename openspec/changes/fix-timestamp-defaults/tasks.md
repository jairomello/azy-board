## 1. Inventário e contrato

- [x] 1.1 Confirmar no schema e em uma base recém-migrada todas as colunas `created_at`/`updated_at` que possuem default temporal literal.
- [x] 1.2 Registrar no teste uma base populada com timestamps históricos e defaults físicos congelados reproduzindo o estado após a migration 0021.
- [x] 1.3 Definir uma função/expressão única para o timestamp UTC ISO dinâmico e validar sua saída no Bun SQLite.

## 2. Schema Drizzle

- [x] 2.1 Substituir `default(new Date().toISOString())` por default avaliado no insert em `tenants`, `users`, `api_keys`, `projects`, `squads`, `project_cost_centers`, `memberships`, `sprints`, `items`, `attachments` e `checklists`.
- [x] 2.2 Manter `items.updatedAt` coerente com a mesma estratégia sem alterar a responsabilidade da aplicação de atualizá-lo em mutações.
- [x] 2.3 Inserir comentários `[DB-SWAP]` documentando o equivalente `TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP` no PostgreSQL.
- [x] 2.4 Regenerar ou revisar o snapshot/journal do Drizzle, se necessário, e garantir typecheck do schema.

## 3. Migration SQLite

- [x] 3.1 Criar migration append-only que reconstrua somente as tabelas com defaults temporais congelados, usando a expressão dinâmica ISO UTC.
- [x] 3.2 Preservar todos os dados existentes, índices, FKs, unicidades, checks e nomes de constraints durante os rebuilds.
- [x] 3.3 Garantir que a migration não altere timestamps históricos nem introduza valores default calculados durante a geração do arquivo.
- [x] 3.4 Validar que a migration é aplicada uma única vez pelo journal e que o fluxo completo permanece seguro em base vazia e populada.

## 4. Testes de comportamento

- [x] 4.1 Testar duas inserções via Drizzle omitindo timestamps e comprovar que os defaults são atuais e não congelados no carregamento do módulo.
- [x] 4.2 Testar inserção SQL direta omitindo timestamp e comprovar que o default físico do SQLite é dinâmico e está no formato ISO UTC.
- [x] 4.3 Testar preservação de valores históricos, contagens, índices e constraints após a migration.
- [x] 4.4 Testar que colunas temporais `NOT NULL` sem default continuam exigindo preenchimento explícito.
- [x] 4.5 Executar testes existentes de migration/integridade e corrigir qualquer regressão de formato ou ordenação temporal.

## 5. Documentação e verificação

- [x] 5.1 Atualizar a documentação de integridade/banco com a política de defaults temporais, formato UTC e equivalente PostgreSQL.
- [x] 5.2 Rodar `bun run typecheck`, `bun test`, `bun run build` e `bun run test:smoke`.
- [ ] 5.3 Fazer backup do banco do LabApps, aplicar a migration e validar defaults, contagens, `PRAGMA foreign_key_check` e logs.
- [ ] 5.4 Registrar resultado do deploy e procedimento de rollback/restauração do backup.
