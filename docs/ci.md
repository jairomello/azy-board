# Integração contínua (CI)

O workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) roda em todo
push de branch e em todo pull request. Os jobs/contextos inventariados no
manifesto são `check`, `contracts`, `smoke`, `e2e`,
`advanced (PostgreSQL + Valkey)` e `image (deploy reproduzível)`. Eles são os
checks esperados pela política local; branch protection/rulesets são configuração
externa, não comprovada por este repositório, e não se afirma que esses jobs
bloqueiam merge. A fotografia por SHA, incluindo limites e estados pendentes,
está em [`release-evidence.md`](release-evidence.md).

## Jobs

### `check`

Validação principal, executada por `bun run check`:

- `bun run typecheck` — TypeScript em `packages/types`, `apps/api`, `apps/web` e `apps/mcp`.
- `bun run lint` — lint real via Biome (ver abaixo).
- `bun test` — suíte de testes do Bun.
- `bun run build` — build de API, Web e MCP.
- `bun run check:api-boundary` — ciclo de dependências, imports e build/boot isolado da API sem `apps/mcp`.

### `contracts`

Gates que detectam divergência de contratos antes do merge:

- `bun run check:i18n` — paridade de chaves e texto fixo fora dos arquivos de idioma.
- `bun run test:mcp-catalog` — catálogo MCP versus registry de ferramentas.
- `bun run test:agent-skill` — skill oficial do agente, comandos e referências.
- `bun run test:migrations` — testes de migration, integridade e timestamps.
- `bun run check:docs` — integridade da documentação (artefatos gerados em dia,
  links internos válidos e ausência de afirmações proibidas).
- `bun run build:web` + `bun run check:bundle` — build do Web e verificação do
  orçamento de bundle (ver abaixo).

### `smoke`

Sobe a API na porta `3001` e o Web na `5173`, usa banco temporário
(`/tmp/azy-ci-smoke.db`) e roda `bun run test:smoke` com tenants efêmeros e
provider determinístico. Além de readiness, login/cookie e `/api/auth/me`, o
smoke exercita criação/edição/movimento/readback de itens, sessão VIEWER,
isolamento entre tenants, recusas de autorização e uma jornada básica do agente.
Logs de API/Web e diagnóstico são publicados em falha; teardown roda sempre.

### `e2e`

Executa `bun run check:frontend-tests` e `bun run test:e2e` em Chromium real com
stack descartável SIMPLE. A suíte cobre login, criação de projeto, CRUD/movimento/
reordenação de cards, Settings, permissões e agente determinístico. Uma falha
Playwright reprova o job e publica trace, screenshot, HTML e logs em
`e2e-diagnostics`. O passo `test:visual` é deliberadamente observacional e tem
`continue-on-error: true`; até a promoção por evidência, não o conte como check
bloqueante.

### `advanced` (PostgreSQL + Valkey)

Gate do perfil ADVANCED com serviços efêmeros:

- **PostgreSQL 16** e **Valkey 8** como serviços do GitHub Actions.
- Migrations pelo runner do perfil (`bun run db:migrate:pg`), sem lista fixa de
  arquivos; schema + FKs compostas e reexecução idempotente.
- Setup CLI (`src/scripts/setup.ts`) criando tenant/admin por marcadores do
  dialect, sem endpoint HTTP de tenant.
- Teste de boot/import por perfil em processo isolado: ADVANCED não pode
  resolver `bun:sqlite`; SIMPLE não exige PostgreSQL/Valkey.
- Testes de migrations (banco vazio, idempotência, tenant-composite, e-mail
  global, CHECKs, timestamps).
- Testes de paridade SIMPLE ↔ ADVANCED (tenant, usuário, projeto, item).
- Testes de coordenação local (rate limiter, pub/sub, isolamento).
- Jornada HTTP real de dois tenants, RBAC, API keys e autorização de WebSocket.
- Jornada determinística do agente (run/tool/aprovação/SSE) contra PostgreSQL,
  com `bun test apps/api/src/advanced-agent.test.ts`.
- Ensaio de rollout/rollback (`advanced-rollout.test.ts`): redeploy do mesmo
  schema mantém marcador/volume/dados e estado incompatível é recusado.
- Ensaio de realtime com **duas instâncias** (`advanced-realtime.test.ts`): dois
  processos da API em portas distintas, clientes WebSocket em réplicas diferentes,
  entrega cross-instância com identidade/sequence, ordem/dedup, replay de eventos
  perdidos, restart com contador preservado, isolamento cross-tenant, cutover de
  cursor legado e rollback para uma API. Evidência do gate multi-instância (T39).
- API e Web reais sobem contra os serviços e o smoke autenticado
  (`bun run test:smoke`) é executado; logs são publicados sanitizados em falha.

O gate avançado é obrigatório para considerar o perfil ADVANCED pronto. Com T39,
o ensaio `advanced-realtime` prova a topologia de **duas instâncias** (entrega,
recuperação e isolamento), mas não promete HA geral — Pub/Sub continua sendo
aceleração transitória com o SQL/outbox como verdade.
O `bun run check` local continua sem serviços externos.

### `image` (deploy reproduzível)

Prova que o deploy constrói a partir de um clone limpo do repositório:

- `bun run check:deploy-versions` — coerência entre `.bun-version`, os
  `ARG BUN_VERSION`/tags dos Dockerfiles e o workflow (reprova tags flutuantes
  de runtime).
- `docker compose config` dos compose files dos perfis SIMPLE e ADVANCED.
- Build das imagens `Dockerfile` (API) e `Dockerfile.web` (nginx) com cache do
  GitHub Actions.
- `bun run test:restore` — teste automatizado de backup e restore em instância
  efêmera nos perfis SIMPLE e ADVANCED: dados de negócio, relações, anexos/hash,
  autenticação/leitura após restore, integridade e `/health/ready`.
- Evidência JSON de cada perfil publicada como artefato com SHA e retenção de 90
  dias, inclusive quando algum gate falha.

Qualquer falha reprova o job; o deploy considerado reproduzível é somente o que
este job constrói.

### `weekly-restore`

`.github/workflows/weekly-restore.yml` executa restore integral SIMPLE e ADVANCED
toda segunda-feira e também permite `workflow_dispatch`. Cada perfil é um job
independente; manifesto/evidência são publicados com o SHA mesmo em caso de
falha. Isso comprova execução periódica quando o workflow é executado, não prova
disponibilidade de branch protection externa.

## Reprodução local

Antes de abrir um pull request, rode os mesmos gates:

```bash
bun install --frozen-lockfile
bun run check

bun run check:i18n
bun run test:mcp-catalog
bun run test:agent-skill
bun run test:migrations
bun run check:docs
bun run build:web
bun run check:bundle

# smoke SIMPLE: use diretório/banco descartáveis e credenciais fictícias
set -e
export DATABASE_URL=/tmp/azy-smoke.db
export AZYBOARD_INSTALL_PROFILE=SIMPLE
export AZYBOARD_INSTANCE_DIR=/tmp/azy-smoke-state
export JWT_SECRET=local-smoke-secret-not-production
export ASSISTANT_ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000
export AZY_AGENT_PROVIDER=stub
export NODE_ENV=test
export FRONTEND_URL=http://localhost:5173
export SMOKE_URL=http://localhost:5173
export SMOKE_API_URL=http://localhost:3001
export SMOKE_ADMIN_EMAIL=smoke-admin@simple.test
export SMOKE_ADMIN_PASSWORD=SmokePass123!
export SMOKE_SECONDARY_ADMIN_EMAIL=smoke-secondary@simple.test
export SMOKE_SECONDARY_ADMIN_PASSWORD=SmokeOther123!

bun run db:migrate
bun run --cwd apps/api src/scripts/setup.ts "Smoke" "smoke" "$SMOKE_ADMIN_EMAIL" "$SMOKE_ADMIN_PASSWORD" "Smoke Admin"
bun run --cwd apps/api src/scripts/setup.ts "Smoke Secondary" "smoke-secondary" "$SMOKE_SECONDARY_ADMIN_EMAIL" "$SMOKE_SECONDARY_ADMIN_PASSWORD" "Smoke Secondary"
bun run --cwd apps/api src/scripts/seed-smoke.ts

setsid env PORT=3001 bun run --cwd apps/api src/index.ts >/tmp/azy-smoke-api.log 2>&1 & API_PID=$!
setsid env AZYBOARD_API_TARGET=http://localhost:3001 bun run dev:web >/tmp/azy-smoke-web.log 2>&1 & WEB_PID=$!
trap 'kill -TERM -- "-$API_PID" "-$WEB_PID" 2>/dev/null || true' EXIT

# Aguarde /health/ready e http://localhost:5173 antes do smoke.
bun run test:smoke

# image: deploy reproduzível (exige Docker + Docker Compose v2)
bun run check:deploy-versions
docker compose -f docker-compose.simple.yml config -q
docker compose -f docker-compose.advanced.yml config -q
docker build -f Dockerfile -t azyboard-api:local .
docker build -f Dockerfile.web -t azyboard-web:local .
bun run scripts/deploy-test-restore.ts --perfil SIMPLE
bun run scripts/deploy-test-restore.ts --perfil ADVANCED

# jornada de navegador
bun run check:frontend-tests
bun run test:e2e
```

Para o smoke ADVANCED, repita o setup com `AZYBOARD_INSTALL_PROFILE=ADVANCED`,
PostgreSQL e Valkey descartáveis, aplique `bun run db:migrate:pg`, rode o setup
para os dois tenants e `seed-smoke.ts`, e suba `src/worker.ts` junto da API. Use
portas livres para API/Web e defina `SMOKE_URL`/`SMOKE_API_URL` de acordo com os
targets do proxy. A receita exata executada no runner é a sequência dos jobs
`smoke` e `advanced` em `.github/workflows/ci.yml`.

## Orçamento de bundle do Web

Dependências pesadas (Recharts, Tiptap) são carregadas sob demanda, e o build
separa vendors em chunks nomeados (`vendor-react`, `vendor-charts`,
`vendor-editor`) para que o orçamento seja estável.

- `bun run build:analyze` — build do Web com relatório visual em
  `apps/web/dist/stats.html` (ativa o `rollup-plugin-visualizer` só nesse
  comando; o build padrão não gera o relatório).
- `bun run check:bundle` — mede o gzip de cada asset em `apps/web/dist/assets`
  e compara com `apps/web/bundle-budget.json`. Falha quando um chunk ultrapassa
  o limite, quando uma regra não casa com nenhum chunk, ou quando o orçamento
  está ausente/malformado.

O CI roda `build:web` antes de `check:bundle`. Para ajustar um limite após uma
mudança intencional, edite `apps/web/bundle-budget.json` no mesmo pull request e
justifique; a tendência é que os limites só diminuam.

## Versão do Bun

A versão é fixada no arquivo [`.bun-version`](../.bun-version) e usada pelo
`oven-sh/setup-bun` no CI. Atualize o arquivo junto com a atualização local
(`bun upgrade`) para manter o ambiente reprodutível.

## Lint com Biome

O `scripts/lint.ts` executa `biome lint .`, configurado em
[`biome.json`](../biome.json). O CI falha quando o lint encontra **erros**.

### Regras desativadas (dívida rastreada)

Estas regras foram desativadas para viabilizar o gate inicial. Cada uma deve ser
reativada em uma change dedicada, corrigindo as ocorrências em lote:

| Regra | Ocorrências | Motivo |
| --- | --- | --- |
| `complexity/useArrowFunction` | ~1212 | normalização de estilo fora do escopo do CI |
| `correctness/noInnerDeclarations` | ~364 | refatoração ampla de declarações em blocos |
| `style/noDescendingSpecificity` | ~304 | ordem de especificidade do CSS legado |
| `style/noNonNullAssertion` | ~256 | usos estruturais em rotas e testes |
| `complexity/noImportantStyles` | ~200 | CSS legado |
| `complexity/useOptionalChain` | ~196 | estilo |
| `style/useTemplate` | ~186 | estilo |
| `style/useConst` | ~1467 | estilo |
| `a11y/*` | ~270 | dívida de acessibilidade do frontend; change dedicada |
| `correctness/useExhaustiveDependencies` | ~52 | hooks exigem análise caso a caso |
| demais `suspicious/complexity/style` | — | itens de estilo/segurança revisados em changes próprias |

Arquivos gerados são ignorados: `docs/architecture`, snapshots de migration
(`**/db/migrations/meta`), `dist`, `build`, `coverage` e `openspec/changes/archive`.

### Avisos remanescentes

O lint ainda reporta avisos (por exemplo `noUnusedImports`,
`noUnusedVariables`, `noExplicitAny`). Eles **não** bloqueiam o CI hoje; a
burn-down deve ser feita incrementalmente. Quando o número chegar a zero,
habilitar `--error-on-warnings` no `scripts/lint.ts` para tornar o gate estrito.

## Integridade da documentação

`bun run check:docs` garante que a documentação não divirja do runtime:

- regenera em memória o catálogo MCP, o OpenAPI e a tabela de limites e compara
  com os artefatos versionados em `docs/generated/` e em `apps/mcp/README.md`;
- valida links internos relativos de Markdown;
- valida o manifesto `docs/release-evidence.json`: estados, comando, evidência,
  SHA completo e data; recusa status verificado sobre working tree alterada e
  usa fixture para provar que evidência ausente é detectada;
- rejeita afirmações proibidas (mantidas em um ponto único no script).

Para atualizar os artefatos depois de mudar um contrato volátil, rode
`bun run generate:docs`. Os papéis de cada fonte estão em `docs/README.md`.

## Proteção externa

O manifesto [`release-policy.json`](release-policy.json) inventaria os jobs e
contextos esperados. A proteção efetiva de branches e rulesets permanece
`NOT_PROVEN`; YAML, workflow verde ou manifesto não comprovam bloqueio de merge.
Configuração externa de required checks não faz parte desta demanda.

Os estados observados, comandos, ressalvas por perfil e metadados de execução
ficam em [`release-evidence.md`](release-evidence.md) e
[`release-evidence.json`](release-evidence.json). Uma execução local sobre
working tree alterada é marcada `LIMITADO`; somente artefato vinculado ao SHA
limpo da execução pode ser `VERIFICADO`.
