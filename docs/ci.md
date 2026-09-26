# Integração contínua (CI)

O workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) roda em todo
push de branch e em todo pull request. Os gates obrigatórios da branch principal
são nomeados exatamente como aparecem nos required checks: `check`, `contracts`,
`smoke`, `e2e`, `advanced` e `image`.

## Jobs

### `check`

Validação principal, executada por `bun run check`:

- `bun run typecheck` — TypeScript em `packages/types`, `apps/api`, `apps/web` e `apps/mcp`.
- `bun run lint` — lint real via Biome (ver abaixo).
- `bun test` — suíte de testes do Bun.
- `bun run build` — build de API, Web e MCP.

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

Sobe a API na porta `3001` e o Web na `5173` e roda `bun run test:smoke`
(`200` na raiz e `401` em `/api/auth/me`). Usa `DATABASE_URL` temporário
(`/tmp/azy-ci-smoke.db`), então não depende de estado externo.

### `advanced` (PostgreSQL + Valkey)

Gate do perfil ADVANCED com serviços efêmeros:

- **PostgreSQL 16** e **Valkey 8** como serviços do GitHub Actions.
- Migrations PostgreSQL (schema + FKs compostas).
- Testes de migrations (banco vazio, idempotência, tenant-composite, e-mail
  global, CHECKs, timestamps).
- Testes de paridade SIMPLE ↔ ADVANCED (tenant, usuário, projeto, item).
- Testes de coordenação local (rate limiter, pub/sub, isolamento).

O gate avançado é obrigatório para considerar o perfil ADVANCED pronto.
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
  efêmera do perfil SIMPLE (sondas no banco e em uploads, `down -v`, restore e
  verificação de integridade + `/health/ready`).

Qualquer falha reprova o job; o deploy considerado reproduzível é somente o que
este job constrói.

## Reprodução local

Antes de abrir um pull request, rode os mesmos gates:

```bash
bun install --frozen-lockfile
bun run check

bun run check:i18n
bun run test:mcp-catalog
bun run test:agent-skill
bun run test:migrations
bun run build:web
bun run check:bundle

# smoke: API em 3001 e Web em 5173
DATABASE_URL=/tmp/azy-smoke.db bun run db:migrate
DATABASE_URL=/tmp/azy-smoke.db JWT_SECRET=local-smoke PORT=3001 \
  bun run --cwd apps/api src/index.ts &
AZYBOARD_API_TARGET=http://localhost:3001 bun run dev:web &
bun run test:smoke

# image: deploy reproduzível (exige Docker + Docker Compose v2)
bun run check:deploy-versions
docker compose -f docker-compose.simple.yml config -q
docker compose -f docker-compose.advanced.yml config -q
docker build -f Dockerfile -t azyboard-api:local .
docker build -f Dockerfile.web -t azyboard-web:local .
bun run test:restore
```

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
- rejeita afirmações proibidas (mantidas em um ponto único no script).

Para atualizar os artefatos depois de mudar um contrato volátil, rode
`bun run generate:docs`. Os papéis de cada fonte estão em `docs/README.md`.

## Required checks

A proteção de branch é configuração externa ao repositório. No GitHub, em
**Settings → Branches → Branch protection rules** (ou Rulesets) da branch
principal, marque como obrigatórios os jobs:

- `check`
- `contracts`
- `smoke`
- `e2e`
- `advanced`
- `image`

### Trabalho solo

Quando uma única pessoa mantém o repositório, a recomendação é **não** exigir
required checks nem PR obrigatório: o CI roda a cada push e serve de sinal,
sem adicionar fricção. Nesse caso, rode `bun run check` localmente antes de
subir e acompanhe o resultado no GitHub Actions.

Ao passar a trabalhar com mais pessoas, ative os required checks acima para
bloquear merge com gate reprovado.
