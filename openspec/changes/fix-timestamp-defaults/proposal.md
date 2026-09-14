## Why

O schema possui defaults como `default(new Date().toISOString())`, avaliados uma única vez quando o módulo é carregado. Em tabelas reconstruídas pela migration 0021, esse instante também foi materializado como literal no DDL, fazendo novas linhas poderem receber um timestamp antigo e idêntico ao de outras inserções. Isso prejudica ordenação, auditoria, histórico e diagnósticos; o Item 11 da análise do sistema deve ser corrigido antes que mais dados sejam criados com esse comportamento.

## What Changes

- Substituir defaults temporais avaliados no carregamento do módulo por defaults avaliados no momento de cada inserção no schema Drizzle.
- Corrigir os defaults físicos das tabelas SQLite existentes que ainda contêm literais congelados, preservando os timestamps já gravados.
- Manter o formato UTC ISO usado pela aplicação, evitando misturar formatos temporais incompatíveis em ordenação e filtros.
- Cobrir todas as colunas `created_at`/`updated_at` que atualmente usam `default(new Date().toISOString())`, sem alterar colunas cujo timestamp é obrigatório e preenchido explicitamente pelo caso de uso.
- Adicionar migration idempotente e segura para bases existentes, com validação em base vazia, base legada e base populada.
- Documentar a estratégia SQLite atual e o equivalente esperado quando o projeto migrar para PostgreSQL.
- Adicionar testes que demonstrem que duas inserções separadas não recebem o mesmo instante congelado e que dados existentes permanecem intactos.
- **BREAKING** Escritas diretas que omitirem timestamps em tabelas sem default declarado continuarão inválidas; o change não transforma campos explicitamente obrigatórios em opcionais.

## Capabilities

### New Capabilities

- `timestamp-integrity`: defaults de timestamps devem ser avaliados por inserção e representar o instante real da criação/atualização.

### Modified Capabilities

- Nenhuma.

## Impact

- `apps/api/src/db/schema.ts`, especialmente as tabelas `tenants`, `users`, `api_keys`, `projects`, `squads`, `project_cost_centers`, `memberships`, `sprints`, `items`, `attachments` e `checklists`.
- Nova migration SQLite e snapshot/journal do Drizzle, se exigido pela ferramenta.
- Testes de schema/migration em `apps/api/src/db/` e possíveis testes de integração que dependam de defaults.
- Documentação de banco e de equivalência SQLite/PostgreSQL.
- Deploy do backend no LabApps, com backup e verificação de timestamps após a migration; nenhuma alteração de API pública prevista.
