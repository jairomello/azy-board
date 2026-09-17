## 1. Inventário e contrato

- [x] 1.1 Catalogar filtros batch que usam `itemTags`/`itemSprints`, resoluções de nome/ID e o fluxo `matched`.
- [x] 1.2 Registrar índices/FKs atuais e definir a query tenant-scoped mínima para cada relação.
- [x] 1.3 Identificar testes existentes de batch, idempotência, `atomic` e multi-tenancy que precisam permanecer verdes.

## 2. Implementação tenant-scoped

- [x] 2.1 Substituir `db.select().from(itemSprints)` global por consulta limitada a tenant + projeto + itens do projeto.
- [x] 2.2 Substituir `db.select().from(itemTags)` global pela consulta equivalente, incluindo `tenant_id` da relação.
- [x] 2.3 Deduplicar pares carregados sem alterar o resultado dos filtros `sprint`/`tag`.
- [x] 2.4 Garantir comentários `[TENANT]` e `[DB-SWAP]` nos novos joins/índices e remover caminhos de filtragem global em memória.
- [x] 2.5 Confirmar que atualização de relações e mudanças de itens continuam filtradas pelo tenant/projeto dentro da transação.

## 3. Testes de isolamento e paridade

- [x] 3.1 Testar batch por sprint no projeto correto e rejeitar vínculo equivalente de outro tenant/projeto.
- [x] 3.2 Testar batch por tag no projeto correto e rejeitar vínculo equivalente de outro tenant/projeto.
- [x] 3.3 Testar tenants com nomes/IDs de relações homônimos sem vazamento no resultado.
- [x] 3.4 Testar `atomic=true`, erro parcial, idempotência e deduplicação de vínculos.
- [x] 3.5 Adicionar teste/regressão que confirme que a consulta não usa carga integral das tabelas globais (ou validar o plano/contagem limitada).

## 4. Índices, documentação e verificação

- [x] 4.1 Medir o plano das queries; criar migration append-only de índice somente se necessário, com `PRAGMA foreign_key_check`.
- [x] 4.2 Atualizar `docs/db-integrity.md`/documentação de batch com a regra de escopo das relações.
- [x] 4.3 Rodar `bun run check`.
- [x] 4.4 Rodar `bun run test:smoke` e suítes de integração/multi-tenancy.
