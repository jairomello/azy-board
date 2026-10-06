Board ref: 932bd490-4503-42b3-9193-5327926fda33

## Context

Conforme `proposal.md` e a revisão de 2026-10-05, há seleção de PostgreSQL em `apps/api/src/persistence/runtime.ts`, mas `index.ts` importa `db/index.ts` antes dela; este último corretamente recusa ADVANCED. `index.ts` também usa `sqliteInstallationMarkerStore` e consultas Drizzle no upgrade WebSocket. `services/analytics.ts` e `dashboardMetrics.ts` importam SQLite; `agentJobQueue.releaseRun()` faz import dinâmico do mesmo driver, inclusive leitura de run só por ID. `scripts/setup.ts` importa a conexão SIMPLE. Imports transitivos precisam ser examinados, não apenas o import principal.

`db/postgres/index.ts` já oferece pool, marker store e transação. `db/installationMarkers.ts` contém contrato genérico e helpers SQLite no mesmo módulo, com import de `integrity`; separar dependências físicas é necessário também nesse caminho. `routes/health.ts` procura `coordination` opcional dentro de persistence, embora `coordination/ports.ts` defina serviço separado. `.github/workflows/ci.yml` aplica lista fixa de migrations e testa adapters, sem iniciar servidor ADVANCED. O histórico `7767ba6` introduziu perfis/ports; `42b87f7` adicionou a fila; isto é conclusão operacional dessas decisões, não troca de arquitetura.

## Goals / Non-Goals

**Goals:** boot e shutdown determinísticos por perfil; mesma autorização/contratos; migrations/setup reais PostgreSQL; readiness fiel; jornada HTTP/web/agente no CI com serviços reais e isolamento de dois tenants.

**Non-Goals:** extração API/MCP/pacotes T40, algoritmo fenced T37, journal/outbox T38, barramento T39, otimização de Dashboard T41 e migração de dados entre perfis. Uma API ADVANCED verificada não libera automaticamente várias réplicas.

## Decisions

1. **Composition root assíncrono e explícito.** Resolver configuração, validar marcador do volume, carregar somente factory do dialect escolhido, verificar banco/marcadores/schema e coordenação, construir serviços/Hono e então aceitar tráfego. Dependências incluem persistência, marker store, health, storage, coordenação e lifecycle; factories recebem objetos tipados em vez de casts entre drivers. Imports de modelos/ports são `type`; nenhum módulo comum pode abrir banco como efeito de import. Preservar uma factory de aplicação para testes/worker sem iniciar listener. Alternativa de remover a proteção de `db/index.ts` foi rejeitada: mascararia o uso incorreto de SQLite.
2. **Fatias de portabilidade necessárias.** Usar `projects.getProject/getMembership` na autenticação WebSocket com tenant/ator; migrar analytics/dashboard para ports já disponíveis ou estendê-los com consultas neutras necessárias; mover cálculos puros para módulos sem driver. Recuperação/retry da fila usa port tenant-scoped, deixando geração/condições adicionais para T37. Contratos de marcadores ficam sem import runtime SQLite; factories físicas mantêm suas próprias auditorias. Não criar rotas duplicadas por perfil nem extrair pacote executor aqui (ownership T40).
3. **Marcadores e schema antes de escrita.** Reutilizar `ensureInstallationMarkers` com store do perfil e validação estrita de pares, inclusive marcador ausente/corrompido e revisão incompatível. Setup/migration inicializam instalação nova pelo fluxo existente; boot não cria tenant nem reaplica migrations. Aplicar todas as migrations pelo runner `db/postgres/migrate.ts`, não uma lista SQL fixa no CI. Falha fecha conexões já abertas e não liga listener. Alternativa de auto-migrate na API foi rejeitada por concorrência e previsibilidade de deploy.
4. **Readiness com dependências reais.** Injetar probes tipados e limitados por timeout para banco/schema pronto, storage e `CoordinationPort.isReady`; coordenação ausente em ADVANCED é falha, não sucesso opcional. Liveness continua independente; erro público contém apenas nomes. Perda de serviço após boot retorna 503; operações dependentes de coordenação não recebem fallback permissivo. Evitar varrer histórico/backfill em cada probe: assert de cutover permanece no startup e probe é consulta limitada.
5. **CI testa processo e contratos.** PostgreSQL 16 e Valkey 8 reais, diretórios novos, migrations/setup CLI idempotentes, API/web em portas dedicadas. Fixtures criam dois tenants e usuários distintos sem endpoint de tenant. Testar login/cookie, `/api/auth/me`, criar/listar projeto, item/relacionamentos, atualização/claim e erro de conflito, dashboard, acesso negativo REST/WebSocket/API key e restart com persistência. Provider HTTP de teste determinístico exercita configuração, criação de run, tool de leitura/mutação e aprovação/eventos SSE sem credenciais externas; não substituir persistence por mock. Antes de T37, a jornada usa lifecycle vigente; após T37, CI sobe o worker separado. Isso evita dependência circular boot ↔ separação.
6. **Fechamento de recursos.** Serviços retornam handles de parada; shutdown recusa novas operações, encerra heartbeat/cleanup/listener e fecha pool/coordenação. Falha parcial fecha o que já foi criado. Quando T37 estiver integrado, shutdown da API ADVANCED não interfere no worker. Repetir inicialização/parada não deixa timers/conexões duplicados.

## Risks / Trade-offs

- [Import transitive reabre SQLite] → inventário do grafo de módulos de produção e teste de import/boot ADVANCED que falha se acessar `bun:sqlite`, PRAGMA ou arquivo SQLite; testes SIMPLE isolados em outro processo.
- [Refatoração altera autorização] → testes positivos e negativos de membership/gerência/grupo/API key em dois tenants, usando os mesmos resultados e códigos atuais.
- [Marcadores e bootstrap concorrentes] → setup único no job de deploy, preflight nas réplicas e rejeição de pares divergentes; nunca sobrescrever marcador para corrigir automaticamente.
- [CI passa apenas caminho feliz] → derrubar PostgreSQL/Valkey separadamente e verificar readiness/erros, restart e persistência; publicar logs sanitizados de processos.
- [Mudança extensa confunde suporte entregue] → matriz por perfil e dependente, distinguindo boot verificado de multi-instância ainda condicionada a T37/T38/T39.

## Migration Plan

Refatorar factories e ports com SIMPLE verde; adaptar setup/migration/readiness; executar instalação ADVANCED nova e CI HTTP/web real. Instalações existentes recebem apenas atualização de código e migrations de schema do próprio dialect, se necessárias; preservar IDs, marcador, credenciais e dados. Backup inclui banco, storage e marcador do volume. Rollback retorna à versão compatível com schema/marcador atual ou restaura backup do mesmo perfil, nunca usa SQLite como recuperação PostgreSQL. Atualizar `README.md`/`DEPLOY.md` com comandos, erros e limites verificados.

## Open Questions

Nenhuma decisão de produto pendente. A extração futura T40 pode mover factories/helpers, mantendo estes contratos; T36 deve entregar sem depender desse rearranjo.
