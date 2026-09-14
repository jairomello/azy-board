## Why

As exclusoes de projetos e itens dependem de listas manuais de tabelas, cada nova relacao pode deixar dados orfaos ou tornar a operacao inconsistente. Alem disso, excluir os metadados de um anexo nao remove automaticamente o objeto fisico no storage. O Item 12 deve transformar a exclusao em um fluxo explicito, verificavel e seguro para multi-tenant antes que o modelo continue crescendo.

## What Changes

- Definir uma politica unica para cascatas de projeto e item, distinguindo dependencias que o banco pode remover por FK das que exigem tratamento de aplicacao.
- Centralizar a descoberta da subarvore e dos recursos associados antes da exclusao, evitando que cada rota mantenha sua propria cascata incompleta.
- Garantir que a transacao do banco seja atomica e que falhas de integridade nao deixem exclusoes parciais.
- Registrar objetos de storage para limpeza apos o commit, com processamento idempotente e tentativa posterior em caso de falha.
- Fortalecer a auditoria de integridade para detectar metadados sem pai, objetos pendentes de limpeza e referencias entre tenants.
- Adicionar testes de exclusao de item e projeto, rollback, isolamento por tenant, idempotencia e limpeza de anexos.

## Capabilities

### New Capabilities

- `deletion-integrity`: plano de exclusao atomico, limpeza pos-commit de storage e auditoria de orfaos.

### Modified Capabilities

- `file-attachments`: a remocao de um card ou projeto tambem deve garantir a limpeza eventual dos arquivos fisicos associados, sem comprometer a transacao dos metadados.

## Impact

- Rotas `apps/api/src/routes/projects.ts` e `apps/api/src/routes/items.ts`.
- Schema, migrations e servicos de integridade em `apps/api/src/db/`.
- Abstracao de storage em `apps/api/src/services/storage.ts` e rota de anexos.
- Novos testes de integracao e auditoria; nenhuma mudanca de permissao ou endpoint publico pretendida.
- O fluxo deve permanecer compativel com SQLite atual e com a futura migracao para PostgreSQL.

Board ref: e958583f-059b-4b27-bcf3-211a860d4e76
