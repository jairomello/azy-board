# Integração contínua (CI)

O workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) roda em todo
push de branch e em todo pull request. Ele é dividido em três jobs obrigatórios,
nomeados exatamente como aparecem nos required checks da branch principal:
`check`, `contracts` e `smoke`.

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
- `bun run build:web` + `bun run check:bundle` — build do Web e verificação do
  orçamento de bundle (ver abaixo).

### `smoke`

Sobe a API na porta `3001` e o Web na `5173` e roda `bun run test:smoke`
(`200` na raiz e `401` em `/api/auth/me`). Usa `DATABASE_URL` temporário
(`/tmp/azy-ci-smoke.db`), então não depende de estado externo.

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

## Required checks

A proteção de branch é configuração externa ao repositório. No GitHub, em
**Settings → Branches → Branch protection rules** (ou Rulesets) da branch
principal, marque como obrigatórios os jobs:

- `check`
- `contracts`
- `smoke`

### Trabalho solo

Quando uma única pessoa mantém o repositório, a recomendação é **não** exigir
required checks nem PR obrigatório: o CI roda a cada push e serve de sinal,
sem adicionar fricção. Nesse caso, rode `bun run check` localmente antes de
subir e acompanhe o resultado no GitHub Actions.

Ao passar a trabalhar com mais pessoas, ative os required checks acima para
bloquear merge com gate reprovado.
