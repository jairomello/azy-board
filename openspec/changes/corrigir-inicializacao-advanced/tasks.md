Board ref: 932bd490-4503-42b3-9193-5327926fda33

## 1. Contratos e inventário do bootstrap

- [ ] 1.1 Mapear imports runtime de `index.ts`, rotas, analytics/dashboard, fila, marcadores e setup; identificar todo acesso a SQLite no grafo ADVANCED e registrar a fatia port/adapter necessária.
- [ ] 1.2 Definir dependências tipadas/factory assíncrona de aplicação e handles de lifecycle em `persistence/runtime.ts`, separando criação Hono de listener/worker sem extrair pacotes T40.
- [ ] 1.3 Estender ports de health/marker/consultas necessárias, mantendo tenant/ator explícitos, comentários `[TENANT]` nos scopes e `[DB-SWAP]` na seleção física, funções pequenas e TypeScript strict.
- [ ] 1.4 Alinhar interface de lifecycle com T37 e documentação dos dependentes T38/T39, sem bloquear teste do boot pelo worker separado ainda não entregue.

## 2. Portabilidade e composição por perfil

- [ ] 2.1 Separar contrato genérico de marcadores de helpers/auditoria SQLite e compor stores SQLite/PostgreSQL sem import físico do outro dialect.
- [ ] 2.2 Retirar imports concretos de `index.ts`; trocar autorização de upgrade WebSocket por ports com tenant/user/membership/gerência/grupo preservados.
- [ ] 2.3 Adaptar `services/analytics.ts` para helpers puros/ports ou adapter, preservando cutover/backfill e eventos/rollups transacionais existentes.
- [ ] 2.4 Adaptar `services/dashboardMetrics.ts` e caminho de Dashboard aos ports do perfil, com resultados e cobertura parcial equivalentes.
- [ ] 2.5 Substituir import SQLite e lookup só por runId em `agentJobQueue.releaseRun()` por port tenant-scoped; deixar evolução de generation/retry condicional para T37.
- [ ] 2.6 Compor persistência, storage e coordenação somente após perfil/preflight; preservar proteção de `db/index.ts` e recusar fallback em ADVANCED.
- [ ] 2.7 Implementar cleanup de startup parcial e shutdown idempotente de pool, coordenação, listener, timers e workers pertencentes ao processo.

## 3. Setup migrations e health

- [ ] 3.1 Adaptar `scripts/setup.ts` ao factory do perfil, com criação de tenant/admin por CLI e validação estrita de marcadores/revisão, sem endpoint novo de tenant.
- [ ] 3.2 Usar runner `db/postgres/migrate.ts` no deploy/CI e remover lista fixa de arquivos SQL; testar instalação vazia e reexecução sem alterar dados válidos.
- [ ] 3.3 Injetar probes tipados/limitados em `routes/health.ts`, incluindo erro quando coordenação ADVANCED não foi composta e consulta de banco limitada sem replay/backfill por requisição.
- [ ] 3.4 Testar marcador divergente/corrompido/ausente, revisão incompatível, banco/storage/Valkey indisponível e ausência de segredos nos erros públicos/logs.

## 4. Prova de aplicação real por perfil

- [ ] 4.1 Criar teste de import/boot ADVANCED em processo isolado com detecção de driver/arquivo/PRAGMA SQLite e regressão SIMPLE sem PostgreSQL/Valkey.
- [ ] 4.2 Preparar fixtures CLI de dois tenants, usuários e API keys para PostgreSQL real, sem mocks de persistence nem credenciais externas hardcoded.
- [ ] 4.3 Exercitar HTTP real de login/cookie/auth-me, projeto/item/relacionamentos, atualização/claim, Dashboard e conflitos, comparando códigos/valores ao SIMPLE.
- [ ] 4.4 Exercitar negativas REST/WebSocket/API key de tenant e projeto sem acesso, além de permissão VIEWER e gerência/admin autorizados.
- [ ] 4.5 Criar provider determinístico de teste para jornada de run/tool/aprovação/SSE e testar agente com PostgreSQL; adaptar startup do teste ao worker T37 quando integrado.
- [ ] 4.6 Reiniciar API após persistir dados e confirmar continuidade; testar shutdown e falha parcial sem vazamento de conexões/timers.
- [ ] 4.7 Atualizar job `advanced` em `.github/workflows/ci.yml` para subir API/web reais, executar jornada/smoke e publicar logs sanitizados em falha.

## 5. Operação e entrega

- [ ] 5.1 Atualizar README/DEPLOY com suporte verificado, setup novo, migrations/backup/restore do próprio perfil e recuperação de marcadores, sem migração SIMPLE → ADVANCED.
- [ ] 5.2 Ensaiar rollout/rollback compatível com schema atual e manter limites multi-instância condicionados aos dependentes.
- [ ] 5.3 Executar testes focados de boot/health/adapters/jornada ADVANCED e SIMPLE e entregar evidências para os gates globais do coordenador.
