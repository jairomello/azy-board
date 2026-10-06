Board ref: 8ee60cea-aa36-4b87-bb0d-e743e5e3e367

## Why

`routes/items.ts` confirma `createItemWithRelations`, publica WebSocket e só depois salva a chave idempotente; `routes/batch.ts` também salva a resposta fora da transação. T38 é P0 porque crash e requisições concorrentes podem duplicar mutações e descolar notificações, auditoria e analytics do estado confirmado.

## What Changes

- Unir reserva única da chave, hash canônico, pré-condições, mutação, resposta persistida, auditoria, analytics e evento de domínio no mesmo commit em SQLite e PostgreSQL.
- Revalidar acesso antes do replay, preservar resposta/status/IDs originais e retornar conflito para mesma chave com outro payload; distinguir dados confirmados de publicação pendente.
- Criar outbox de domínio durável com sequência por tenant/projeto, publicação pós-commit, retry e deduplicação; conservar a outbox específica de limpeza de storage.
- Cobrir criação/edição/movimento/claim, batches, projeto/planning/cadastros/checklists/logs/links e transições persistentes do agente afetadas, revisando limites/posições e leitura seguida de escrita.
- Disponibilizar contrato comum para T37 e para as changes de cadastros, lacunas, transição de sprint e duplicação, sem implementar suas funcionalidades nesta change.
- Provar rollback, commit sem resposta, disputa de chave e crash de publicação com falha injetada e concorrência real nos dois bancos.

## Capabilities

### New Capabilities

- `transactional-mutation-journal`: unidade transacional de comandos idempotentes, replay autorizado e resultados consultáveis.
- `domain-event-outbox`: eventos confirmados duráveis, ordenação por projeto e despacho pós-commit recuperável.

### Modified Capabilities

Nenhuma. Contratos públicos existentes permanecem; campos operacionais e chave opcional são aditivos.

## Impact

- `apps/api/src/services/idempotency.ts`, `routes/{items,batch,projects,sprints,checklists,itemLinks,assistant}.ts`, ports/modelos, schemas/migrations SQLite/PostgreSQL e UnitOfWork/analytics existentes.
- Dispatcher e testes de falha a criar; documentação da retenção/replay e integração do agente. Transporte em Valkey/entre APIs fica em T39.
- T36 é necessário para provar a API ADVANCED inteira, mas não bloqueia contratos/adapters desta change. T37 consome journal com contexto fenced; T40 extrai aplicação/pacotes, sem assumir ownership de tabelas transacionais.
- `gerenciar-squads-cadastros-agente`, `consultar-lacunas-planejamento`, `preparar-transicao-sprint` e `duplicar-estruturas-trabalho` são consumidores: chave/hash/resultado, revalidação e outbox são única base compartilhada.
- Migrations aditivas somente dentro de cada perfil; nenhuma transferência de dados SIMPLE ↔ ADVANCED.
