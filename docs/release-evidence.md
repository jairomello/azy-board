# Evidências e limites de release

Esta matriz separa comportamento exercitado de configuração externa. Os estados
são `VERIFICADO` (artefato ligado a commit limpo), `LIMITADO` (prova local ou
cobertura parcial), `PENDENTE` (ainda não executado) e `NAO_COMPROVADO` (não há
acesso/prova). O manifesto estruturado está em
[`release-evidence.json`](release-evidence.json); o gate `bun run check:docs`
valida campos, SHA, data e consistência dos estados.

## Proveniência desta fotografia

- Data: 2026-10-07.
- Branch/commit base: `main`, `6f311de528b643760ac38aaac3efa671957a498e`.
- Working tree: `DIRTY`; a execução local contém mudanças não commitadas e não
  deve ser apresentada como artefato produzido por esse commit.
- `runId` e URL de artefato do GitHub Actions: indisponíveis nesta sessão.
- A matriz não declara proteção de merge. Required checks externos, rulesets e
  atores de bypass continuam `NAO_COMPROVADO`.

## Garantias e limites por perfil

| Perfil/capacidade | Garantia documentada | Verificação principal | Estado nesta fotografia |
|---|---|---|---|
| SIMPLE | SQLite; API e worker do agente no mesmo processo; sem serviço externo obrigatório. | Job `smoke`, E2E de navegador e restore SIMPLE no workflow `ci`. | LIMITADO: smoke passou; 8/8 E2E passaram; restore passou. Working tree alterada. |
| ADVANCED | PostgreSQL + Valkey; migrations e setup explícitos; worker dedicado; smoke HTTP autenticado. | Job `advanced` com serviços reais e job `image`; teste de restore ADVANCED. | LIMITADO: smoke passou; 10 suítes ADVANCED e restore passaram. Working tree alterada. |
| Recuperação | Restore integral exige instância/volume limpos e downtime; tempos observados estão nos manifestos de restore. Não define RTO/RPO contratual. | `bun run test:restore` para cada perfil; workflow semanal publica artefato por SHA. | LIMITADO: ambos os restores passaram em imagem recém-buildada; sem artifact URL do CI. |
| Dashboard T41 | Budgets SIMPLE/ADVANCED v3 aceitos para esta versão e hardware de referência documentado. | `docs/dashboard-performance.md` e runner `dashboard-benchmark.ts`. | VERIFICADO para a rodada de benchmark aceita; a otimização futura está no T44. |
| Regressão visual | Comparação observacional; o passo usa `continue-on-error: true`. | `bun run test:visual`; diferenças em `tmp/visual-diffs/`. | LIMITADO; não é gate bloqueante. |
| Proteção externa de merge | Nenhuma garantia declarada. | Consulta de leitura e auditor local em `docs/release-policy.json`. | NAO_COMPROVADO e fora de escopo de T43 por decisão do usuário. |

Na execução local de 2026-10-07, o restore SIMPLE mediu backup 3.783 ms e
recuperação 4.636 ms; ADVANCED mediu backup 2.486 ms e recuperação 6.807 ms.
Ambos recuperaram 1 projeto, 1 módulo, 3 itens e 1 anexo; 24 verificações de
negócio passaram, sem objeto ausente nem divergência de hash do anexo. São
medições deste ambiente, não compromisso de RTO/RPO. Os dados completos estão
nos manifestos em `tmp/test-restore-*/restore-evidence.json`.

## Jobs e checks esperados no workflow

| Contexto/job | Cobertura | Evidência de falha esperada | Estado |
|---|---|---|---|
| `check` | Typecheck, Biome, persistência/API boundary, suíte e build. | Exit code não zero interrompe o job; diagnósticos são publicados quando existem. | LIMITADO: passou localmente (1.251 testes, 23 ignorados), working tree alterada. |
| `contracts` | i18n, catálogo MCP, skill, migrations, docs, build web e bundle. | Qualquer comando não zero interrompe o job. | LIMITADO: comandos passaram localmente, working tree alterada. |
| `smoke` | Login/cookie, readiness, CRUD, RBAC, isolamento entre tenants e agente determinístico SIMPLE. | Smoke falha o job; logs sanitizados são publicados. | LIMITADO: passou em SQLite temporário; working tree alterada. |
| `e2e` | Jornadas de navegador em SIMPLE e regressão visual observacional. | Falha de Playwright falha o job e publica trace/screenshot/HTML; visual segue observacional. | LIMITADO: 8/8 jornadas passaram localmente; working tree alterada. |
| `advanced (PostgreSQL + Valkey)` | Migrations, boot, HTTP, agente, worker fenced, rollout e realtime ADVANCED. | Primeiro teste ou smoke com falha encerra o job; logs sanitizados são publicados. | LIMITADO: 10 suítes e smoke passaram com serviços descartáveis; working tree alterada. |
| `image (deploy reproduzível)` | Compose, build de imagens, restore SIMPLE e ADVANCED. | Build/restore não zero falha o job; evidências JSON são publicadas mesmo em falha. | LIMITADO: builds e os dois restores passaram localmente; working tree alterada. |
| `weekly-restore` | Restore integral nos dois perfis semanalmente ou por dispatch manual. | Cada perfil tem job separado e a conclusão não zero fica visível no workflow. | Workflow versionado; execução remota ainda não observada. |

Esses são os contextos esperados pelo manifesto local. A lista não afirma que
GitHub os exige para merge. Essa configuração só pode ser confirmada com acesso
administrativo ao repositório, e permanece fora do escopo desta change.

## Falhas controladas e critérios de bloqueio do job

As falhas de contrato são exercitadas por testes que esperam rejeição: check
ausente/renomeado/app divergente e permissão externa indisponível em
`scripts/audit-release-policy.test.ts`; artefato ausente, hash adulterado e perfil
incompatível em `scripts/deploy-lib.test.ts`; manifesto com evidência ausente e
working tree suja em `scripts/docs/releaseEvidence.test.ts`. O smoke também
espera 401/403/404 nos cenários sem sessão, VIEWER e isolamento de tenants. Os
comandos dos jobs essenciais usam o fail-fast padrão do GitHub Actions; apenas a
regressão visual declara `continue-on-error: true`. Não houve dispatch deliberado
de um job GitHub falho nesta sessão; nenhuma conclusão externa de merge é inferida.

## Resultados relacionados às changes T36–T42

O board registra T36–T42 como concluídos; isso é rastreamento de trabalho, não
substituto para artefato de release. As verificações e limites operacionais são:

| Change | Evidência exercitável | Limite que permanece documentado |
|---|---|---|
| T36 — boot ADVANCED | `bun test apps/api/src/boot/boot-profile.test.ts apps/api/src/advanced-http.test.ts`; CI `advanced`. | Banco PostgreSQL/Valkey e runtime externos só são cobertos quando o job com serviços reais executa. |
| T37 — worker do agente | `bun test apps/api/src/advanced-worker-fence.test.ts`; CI `advanced`. | Efeitos já aceitos por fornecedor externo não têm promessa de exactly-once. |
| T38 — idempotência/outbox | `bun test apps/api/src/services/domainEventDispatcher.test.ts`; suite API e CI `advanced`. | Commits legados sem chave não têm garantia retroativa. |
| T39 — realtime multi-instância | `bun test apps/api/src/advanced-realtime.test.ts`. | Pub/Sub acelera entrega; SQL/outbox permanece fonte durável, sem promessa de HA geral. |
| T40 — fronteira API/MCP | `bun run check:api-boundary` e `bun run test:mcp-catalog`. | A API e o servidor MCP continuam processos separados e exigem compatibilidade de versão. |
| T41 — escala do Dashboard | `docs/dashboard-performance.md`; budgets v3 aceitos pelo usuário em 2026-10-07. | T44 continua no Backlog para melhoria adicional; não confundir com os budgets aceitos atuais. |
| T42 — Board/i18n/testes | `bun run check:i18n`, `bun run check:frontend-tests`, `bun run test:web` e `bun run test:e2e`. | Baselines visuais seguem observacionais; acessibilidade e comportamento seguem os limites registrados em `TESTING.md`. |

## Definição curta de pronto

Uma mudança está pronta quando os gates aplicáveis passam, smoke e restore cobrem
os perfis suportados, a documentação aponta evidência com SHA/data e ressalvas,
e nenhum estado `PENDENTE` é apresentado como aprovado. Evidência de working
tree alterada é limitada; proteção externa só pode ser declarada depois de prova
administrativa independente.

## Reprodução e publicação

Os comandos por gate e instruções para SIMPLE/ADVANCED estão em
[`ci.md`](ci.md), [`../TESTING.md`](../TESTING.md) e
[`../DEPLOY.md`](../DEPLOY.md). O workflow de CI e o semanal publicam logs/artefatos
por SHA; para uma release real, substituir `runId`/URLs indisponíveis nesta
fotografia pelos metadados do GitHub Actions. Restore completo inclui downtime;
use os tempos medidos do manifesto e não extrapole RTO/RPO.
