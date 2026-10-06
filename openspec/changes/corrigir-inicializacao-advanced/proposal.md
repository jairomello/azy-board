Board ref: 932bd490-4503-42b3-9193-5327926fda33

## Why

A revisão `docs/ANALISE-SISTEMA-ATUALIZADA-2026-10-05.md` constatou que a API ADVANCED falha no boot com `ADVANCED_DATABASE_ADAPTER_NOT_READY`, apesar de possuir adapter PostgreSQL. T36 é P0 porque paridade de adapters isolados não demonstra que autenticação, rotas e agente funcionam no servidor real.

## What Changes

- Compor a aplicação por perfil validado, retirando dependências SQLite do caminho ADVANCED e usando ports tipados para marcadores, autorização WebSocket, analytics, dashboard e recuperação da fila.
- Fazer setup, migrations e boot usarem o driver selecionado, sem fallback; preservar instalação e marcadores imutáveis.
- Tornar readiness uma verificação efetiva de banco, storage e coordenação, inclusive quando o adapter esperado está ausente.
- Iniciar API e web reais no CI ADVANCED com PostgreSQL/Valkey; exercitar login, projeto, item, isolamento e jornada de agente com provider de teste determinístico.
- Documentar suporte verificado e recuperação por perfil; não fornecer migração de dados SIMPLE → ADVANCED.

## Capabilities

### New Capabilities

- `advanced-api-bootstrap`: composição, lifecycle e prova operacional da API completa no perfil ADVANCED, além da paridade de ports já especificada.

### Modified Capabilities

Nenhuma. As garantias de `installation-profiles` e `health-endpoints` são preservadas e ganham prova de integração.

## Impact

- `apps/api/src/index.ts`, `persistence/{runtime,ports}.ts`, `db/installationMarkers.ts`, `db/postgres/index.ts`, `routes/health.ts`, `services/{analytics,dashboardMetrics,agentJobQueue}.ts`, `scripts/setup.ts` e adapters SQLite/PostgreSQL.
- `.github/workflows/ci.yml`, `docker-compose.advanced.yml`, fluxo de migrations/deploy, `README.md` e `DEPLOY.md`; contratos HTTP e autorização permanecem compatíveis.
- T37 define separação/fencing do worker; T38 define journal/outbox; T39 define transporte distribuído. T36 não anuncia multi-instância segura antes desses dependentes.
- T40 é responsável por extração de pacotes/casos de uso API/MCP; aqui só se corrigem composição e acessos concretos ao driver necessários ao boot. Interfaces deverão convergir, sem segunda camada de aplicação.
