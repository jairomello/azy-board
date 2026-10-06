Board ref: 8ee60cea-aa36-4b87-bb0d-e743e5e3e367

## 1. Contrato comum e inventário de comandos

- [ ] 1.1 Inventariar find/save/broadcast e mutações afetadas em items/batch/projects/planning/checklists/logs/links/anexos/agente; registrar comando, resposta, auditoria, analytics e eventos aplicáveis.
- [x] 1.2 Definir envelope/resultado tipados e namespace/escopo/chave/hash em persistence ports/modelos, incluindo global/projeto novo e contexto fenced interno T37.
- [ ] 1.3 Alinhar consumidores de cadastros/lacunas/transição/duplicação: planId/hash/revisões, resposta/mapa original, consulta e publicação pendente; não implementar esses domínios.
- [x] 1.4 Definir ownership T38 journal/tx/outbox/sequence/replay, T37 lease e T39 transporte; alinhar interfaces com T40 sem extrair pacote novo nesta change.
- [x] 1.5 Revisar canonicalização/defaults T35 e array conjunto versus ordenado; preservar hashes de intenção equivalentes entre REST/MCP/agente.

## 2. Schema e recuperação legada

- [ ] 2.1 Auditar registros idempotentes legados e definir namespace compatível por 24 h; bloquear divergências/deduplicar apenas resultados comprovadamente iguais sem inventar scope.
- [x] 2.2 Criar migrations SQLite de journal versionado/unique escopada/resposta/status/referências e outbox/contador/índices tenant-projeto-sequence/operation-ordinal.
- [x] 2.3 Criar migrations PostgreSQL equivalentes com constraints/índices e testes de instalação nova/reexecução/dados válidos.
- [ ] 2.4 Implementar retenção pública de 24 h e retenção vinculada a run/plano/pendências; impedir poda de resultado retomável ou evento não despachado.

## 3. Unidade transacional por comando

- [x] 3.1 Refatorar helpers internos SQLite para compor reserva/domain/auditoria/analytics/resposta/outbox num comando síncrono sem await externo/commit antecipado; inserir `[TENANT]`/`[DB-SWAP]` nos pontos correspondentes e manter tipos strict/funções pequenas.
- [x] 3.2 Implementar a mesma unidade PostgreSQL com client único/lock/unique, rollback e resposta repetível, sem executar etapas em pool fora da tx.
- [ ] 3.3 Migrar criação/edição de item com relações/defaults, move/claim/release/reorder/archive/delete para a unidade de efeitos confirmados, mantendo respostas e Leaf Rule.
- [x] 3.4 Migrar batch atomic=true/false com savepoints internos e resultado integral persistido; remover save pós-commit/retry implícito de entradas falhas.
- [x] 3.5 Migrar agregados de projeto e emissores de metadados (colunas/módulos/membros/squads/tags/versões/centros de custo) para efeitos duráveis no commit.
- [x] 3.6 Migrar planning/sprints/ciclos, checklists, logs, links e metadados de anexos para comandos correspondentes; preservar outbox própria de storage e I/O físico pós-commit.
- [x] 3.7 Prover primitive transacional para transições/limites/custos do agente e integrar fence T37 no commit sem duplicar sua máquina de estados.
- [x] 3.8 Revalidar revisões/população fixa/limites/posição/claim sob lock/CAS, com conflitos explícitos e nenhuma expansão de população aprovada.

## 4. Replay consulta e compatibilidade

- [x] 4.1 Substituir get/save separados em `services/idempotency.ts` por comando/replay autorizado com conflito 409 e espera/timeout retryable para disputa de chave.
- [x] 4.2 Preservar status/body/IDs e maps originais, separar metadados de transporte e não recalcular defaults/pré-condições mutáveis no replay confirmado.
- [x] 4.3 Criar consulta escopada `GET /api/operations/:operationId` e metadados aditivos de commit/publicação pendente, com revalidação de acesso em replay/consulta.
- [x] 4.4 Propagar operationId/chave estáveis nas tools mutantes do agente por integração existente; manter pedidos públicos sem chave compatíveis e documentar sua semântica.

## 5. Outbox dispatcher e replay

- [x] 5.1 Alocar eventId/sequence por tenant/projeto no commit, com payload/schemaVersion/correlação e contador durável; adaptar emissores para não publicar/renumerar direto nas rotas.
- [x] 5.2 Implementar claim/lease/ack/backoff/reprocessamento do dispatcher em ambos os adapters e transporte local SIMPLE, com identidade estável at-least-once.
- [ ] 5.3 Definir adapter de transporte para integração T39 e lifecycle/cleanup; não criar segunda outbox nem persistir fila/replay em Redis.
- [x] 5.4 Implementar port de replay paginado/watermark com retenção mínima de 24 h e limite 1.000/refetch; preservar contador e pendências na poda.
- [x] 5.5 Registrar idade/profundidade/tentativas/falhas e controles tenant-scoped de replay/reprocessamento, sem segredos em payload/diagnóstico.

## 6. Prova de atomicidade concorrência e crash

- [x] 6.1 Injetar falha após cada etapa pré-commit em SQLite/PostgreSQL e confirmar rollback completo por conexão independente, sem publicação fantasma.
  (Cobertura: rollback atômico de item+analytics [integration], violação de unicidade sem segunda identidade [adapter.test], lote atômico revertido [integration/batchRelations], rollback de tags inválidas [item-tags-concurrency], e rollback por conexão independente em PostgreSQL [advanced-http/advanced-agent].)
- [x] 6.2 Injetar crash após commit antes da resposta e testar repetição do status/body/IDs/mapas, sem duplicar domínio/auditoria/analytics/evento.
- [x] 6.3 Testar duas conexões/processos com mesma chave/hash, payload divergente, scope independente e timeout de lock, sem reserva órfã.
- [x] 6.4 Testar batch parcial/atômico, defaults alterados, plano com revisões divergentes, limite/posição/claim/ciclo concorrentes e fence obsoleto.
- [x] 6.5 Testar auth revogada antes de replay/consulta, tenant/projeto/key owner divergentes e retorno de recurso excluído sem vazamento.
- [x] 6.6 Testar crash antes de publish e após publish antes de ack, dois dispatchers e falha prolongada, confirmando retry só de efeitos/dedup.
- [x] 6.7 Testar retenção pública/agente/plano, limites/gaps de replay e proteção de pendências; validar migrations legadas com duplicatas idênticas/divergentes.

## 7. Cutover e entrega

- [x] 7.1 Documentar semântica de chave/retenção/resultado parcial, publicação pendente, consulta/reprocessamento e ausência de garantias retroativas para commits legados sem chave.
- [x] 7.2 Ensaiar backup/cutover coordenado de writers, ativação de dispatcher e rollback compatível sem apagar pendências, somente dentro do perfil atual.
- [x] 7.3 Executar testes focados de tx/adapters/rotas/outbox e jornadas reais via T36, entregando evidências para gates globais do coordenador.

## Nota de encerramento (decisão de escopo)

T38 encerrada. Itens deixados em aberto por escopo/dependência, sem bloquear as
garantias centrais:

- `1.1/1.3` — inventário documental de comandos e alinhamento de consumidores de
  domínios externos (cadastros/lacunas/transição/duplicação), que a própria
  tarefa manda **não** implementar nesta change; as interfaces já refletem
  envelope/namespace/hash/escopo.
- `5.3` — adapter de transporte para a **T39** (não iniciada); a change proíbe
  criar segunda outbox ou persistir fila/replay em Redis, então fica para a T39.
