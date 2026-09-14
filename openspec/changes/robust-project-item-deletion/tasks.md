## 1. Inventario e politica de integridade

- [x] 1.1 Catalogar todas as FKs e tabelas tocadas por exclusao de projeto, item, checklist, tags, sprints, anexos, logs e conversas.
- [x] 1.2 Documentar para cada relacao a estrategia `ON DELETE CASCADE`, `SET NULL` ou delete explicito, incluindo a referencia `simple_story_id`.
- [x] 1.3 Criar testes de auditoria que detectem orfaos e referencias cross-tenant sem modificar a base.

## 2. Outbox e processamento de storage

- [x] 2.1 Adicionar migration e schema para jobs de limpeza com tenant, caminho, recurso, status, tentativas, erro e timestamps.
- [x] 2.2 Implementar insercao idempotente de jobs dentro da transacao que remove metadados de anexos.
- [x] 2.3 Implementar processador pos-commit usando `StorageAdapter`, tratando arquivo inexistente como sucesso e falhas como retry com backoff.
- [x] 2.4 Integrar processamento no ciclo de vida da API e adicionar logging/consulta de jobs pendentes e falhos.

## 3. Executor compartilhado de exclusao

- [x] 3.1 Implementar carregamento paginado da subarvore de itens limitado por tenant e projeto.
- [x] 3.2 Implementar executor transacional para exclusao de item, checklists, relacoes, logs e anexos, retornando os paths a enfileirar.
- [x] 3.3 Implementar executor transacional para exclusao de projeto reutilizando a politica comum e cobrindo recursos de projeto e conversas do agente.
- [x] 3.4 Migrar as rotas de item e projeto para o executor sem alterar autorizacao, respostas HTTP ou confirmacao dry-run.
- [x] 3.5 Garantir limpeza previa de referencias especiais e validacao de `tenantId` em todos os deletes.

## 4. FKs e migrations

- [x] 4.1 Aplicar somente as cascatas de banco justificadas pela politica e preservar constraints, indices e dados legados.
- [x] 4.2 Adicionar migration append-only compativel com SQLite e registrar orientacao `[DB-SWAP]` para PostgreSQL.
- [x] 4.3 Validar migration em base vazia, base populada e base com dados legados, incluindo `PRAGMA foreign_key_check`.

## 5. Testes de comportamento

- [x] 5.1 Testar exclusao de item folha e de subarvore com checklists, tags, sprints, logs e anexos.
- [x] 5.2 Testar exclusao de projeto completo e ausencia de registros filhos ou metadados orfaos.
- [x] 5.3 Testar rollback quando uma operacao falha e confirmar que nenhum job de storage e publicado antes do commit.
- [x] 5.4 Testar isolamento entre tenants e tentativas de exclusao por IDs de outro tenant.
- [x] 5.5 Testar retry, idempotencia, arquivo ausente e falha persistente do adapter de storage.

## 6. Verificacao e documentacao

- [x] 6.1 Atualizar a documentacao de integridade com a politica de cascatas e o ciclo de vida dos jobs de storage.
- [x] 6.2 Executar `bun run check`.
- [x] 6.3 Executar `bun run test:smoke` e os testes de migration/integridade.
