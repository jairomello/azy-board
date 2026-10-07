# Testes

## Visão Geral

O projeto usa vários níveis de verificação:

- Testes de integração Bun para o backend, com banco SQLite em memória.
- Testes de comportamento (hooks, adapters e `model/`) e de componente (DOM) para o frontend.
- Testes de contrato estrutural apenas para invariantes não comportamentais, com justificativa.
- E2E de navegador (Playwright) e regressão visual para as telas críticas.
- Testes unitários e de contrato para regras de domínio, UI e integrações MCP.
- Smoke test HTTP para validar uma aplicação local ou publicada.

Os testes não usam o banco persistente, não criam arquivos de upload e não
exigem credenciais reais.

## Local

Os testes de integração da API usam SQLite em memória e não alteram `dev.db`:

```bash
bun run test:integration
```

Esse comando executa `apps/api/src/integration.test.ts` e cobre:

- migração do schema e default `HIERARCHICAL`;
- criação de projetos simples e hierárquicos;
- criação automática da STORY fixa e associação de TASK;
- conversão simples para hierárquico e hierárquico para simples;
- ciclo de sprints `PROPOSED`, `OPEN` e `CLOSED`, incluindo datas obrigatórias e bloqueio de novas associações em sprints fechadas;
- preservação de cards, tags, sprints, anexos, checklists e logs;
- bloqueio de MEMBER e isolamento entre tenants.

Os contratos do servidor MCP podem ser verificados sem servidor externo:

```bash
bun run test:mcp
bun run test:mcp-catalog
```

Esses comandos cobrem o catálogo de ferramentas, validação de argumentos,
fluxos de board, idempotência, erros estruturados e a obrigatoriedade de
política de autorização por ferramenta. As API Keys usadas nos testes são
simuladas e não são credenciais reais.

## Testes de frontend

O frontend segue três níveis:

1. **Comportamento sem DOM** — regras de negócio, hooks e adapters devem viver em
   módulos sem dependência direta de React (por exemplo, `features/*/model/` e
   `lib/`) e ser exercitados com entradas e dependências injetadas. É o nível
   preferido: rápido e estável.
2. **Componente com DOM** — renderização, interação e acessibilidade usam
   `happy-dom` + Testing Library. O setup fica em
   `apps/web/src/test/setup.ts` e é importado **explicitamente** no topo de cada
   teste de componente (`import '../test/setup'`); não há preload global, para
   não injetar `window`/`document` nos testes de API e MCP. O `screen` exportado
   pelo setup resolve as consultas em `document.body` no momento do uso.
3. **E2E de navegador** — jornadas críticas no navegador real.

Os testes de componente dependem de estado global de DOM e, por isso, os
arquivos de teste são executados isolados (`bun test --isolate`, já embutido em
`bun run test`, `bun run check` e `bun run test:web`). Sem o isolamento, arquivos
distintos competem pelo mesmo `document`.

```bash
bun run test:web          # suíte do web (isolada)
bun run check             # typecheck + lint + testes (isolados) + build
```

### Política de testes de contrato estrutural

Testes que apenas leem o código-fonte (por exemplo,
`fetch(new URL('./Componente.tsx', import.meta.url))`) só são aceitos para
invariantes **não comportamentais** (cobertura de chaves i18n, fronteiras de
módulo, layout CSS que o `happy-dom` não calcula, tokens visuais) e precisam do
marcador `[CONTRATO-ESTRUTURAL] <motivo>` no arquivo. Um teste de comportamento
equivalente é sempre preferível. A verificação abaixo falha quando um teste lê o
fonte sem o marcador:

```bash
bun run check:frontend-tests
```

### Modularização do Board, i18n e interação (T42)

Fronteiras extraídas do `BoardScreen` (que passou a ser composition root, sem HTTP
nem regras inline): `model/boardView.ts` (filtros/população), `model/{interaction,
mutation}.ts`, `hooks/useBoardData`, `hooks/useBoardPreferences`,
`hooks/useBoardInteraction`, `hooks/useBoardItemEditing`, `hooks/useBoardItemModal`,
`hooks/useBoardArchiving`, `hooks/useBoardFilterValidation` e
`hooks/useBoardAgentSession`. A cobertura comportamental correspondente vive em
`model/boardView.test.ts`, `board-interaction.test.ts` e nos testes DOM de
componente (`board-filters`, `add-card-form`, `board-modals`, `inline-edit`).

- **Contratos estruturais mantidos**: layout/CSS que o `happy-dom` não calcula,
  fronteira de módulos e uso obrigatório de `resolveAppUrl`. **Substituídos**: os
  que liam o `BoardScreen` para alegar comportamento (filtros/população,
  snapshot/foco, mutação otimista) agora apontam ao módulo onde o comportamento
  passou a residir ou foram cobertos por testes observáveis.
- **i18n**: `scripts/check-i18n.ts` usa a AST do TypeScript (Apache-2.0, sem nova
  dependência) para paridade dos locales e para detectar texto fixo sem acento em
  JSXText, atributos acessíveis/visíveis, `toast` e chaves inválidas. Chaves
  dinâmicas opacas precisam estar em `apps/web/src/i18n/dynamic-keys.json`;
  templates/ternários com conjunto finito são aceitos. Exceções estreitas:
  marcas/provedores, unidades (`bytes`, `pt`), símbolos e identificadores
  técnicos (`EXEMPT_LITERALS`), além de `// i18n-exempt: <motivo>` por linha.
  Conteúdo do usuário, URLs e identificadores não são tratados como texto.
- **Acessibilidade**: o diálogo de `BoardModals` expõe `role="dialog"`,
  `aria-modal` e nome acessível, com foco inicial e Escape; controles com nome
  acessível verificados; feedback/rótulos presentes em PT-BR/EN/ES. A alternativa
  de teclado ao drag é o select de status da modal de item.
- **Rollback do frontend**: reverter o bundle para a imagem anterior; não apagar
  preferências (`localStorage`/`sessionStorage`) nem alterar a versão do snapshot
  do agente. Não há migration de banco nesta mudança.

Comandos para o gate de release (T43):

```bash
bun run check              # typecheck + lint + persistência + testes + build
bun run check:i18n         # paridade + texto/chaves via AST
bun run check:frontend-tests
bun run test:web
bun run check:docs
bun run test:e2e
bun run scripts/deploy-test-restore.ts --perfil SIMPLE
bun run scripts/deploy-test-restore.ts --perfil ADVANCED
```

### E2E de navegador (Playwright)

A suíte sobe um stack descartável (SQLite temporário + API + web), semeia um
membro e o Azy Agent determinístico e cobre login, criação de projeto, board
(criar/mover/reordenar cards por arrastar), Settings (coluna, módulo e squad),
permissões e a jornada do agente sem provider de LLM real.

```bash
bun run test:e2e
```

Pré-requisitos e variáveis:

- Chromium do sistema em `/usr/bin/chromium`, ou o Chromium empacotado do
  Playwright (`bunx playwright install chromium`) com
  `PLAYWRIGHT_CHROMIUM_EXECUTABLE=""`.
- `E2E_API_PORT` (padrão `3001`) e `E2E_WEB_PORT` (padrão `5173`).

O agente usa `AZY_AGENT_PROVIDER=stub`; o provider determinístico é proibido
quando `NODE_ENV=production`. Em falha, screenshots são gravados em
`tmp/e2e-failures/`.

### Regressão visual

Compara screenshots de login, projetos, board, Settings e dashboard com
baselines versionados em `e2e/__screenshots__/` (viewport e tema fixos,
tolerância de 2%). Para regenerar de forma intencional, no mesmo ambiente do CI:

```bash
E2E_UPDATE_SNAPSHOTS=1 bun run test:visual
```

Diferenças são gravadas em `tmp/visual-diffs/`. A regressão visual roda em modo
de observação no CI (`continue-on-error: true`) até as baselines estabilizarem em
todos os ambientes; ela não é required check bloqueante.

### Bateria completa

```bash
bun run test:regression --with-e2e   # inclui E2E de navegador e regressão visual
```

Para a validação completa do monorepo:

```bash
bun run check
```

O comando de smoke exercita o fluxo autenticado do perfil apontado pelas
variáveis de ambiente: readiness, sessão/cookie, criação/edição/movimento e nova
leitura de item, VIEWER, isolamento entre dois tenants e jornada do agente
determinístico. Rode-o uma vez em cada perfil usando serviços descartáveis; no
ADVANCED configure PostgreSQL e Valkey, aplique migrations e inicie o worker
separado antes do smoke. A CI automatiza os dois cenários nos jobs `smoke` e
`advanced`.

Para validar uma publicação fora da CI, inicie API e Web no perfil já instalado e
execute:

```bash
bun run test:smoke
```

Para smoke autenticado contra uma instalação já configurada, forneça credenciais
de teste descartáveis por `SMOKE_ADMIN_EMAIL`, `SMOKE_ADMIN_PASSWORD` e
`SMOKE_SECONDARY_ADMIN_EMAIL`/`SMOKE_SECONDARY_ADMIN_PASSWORD`; use `SMOKE_URL` e
`SMOKE_API_URL` para informar os endpoints. Não use contas de produção: o smoke
cria e altera itens de teste.

O estado por perfil, comandos, SHA, data e limites das evidências está em
[`docs/release-evidence.md`](docs/release-evidence.md). Uma saída local na
working tree alterada é limitada e não deve ser descrita como artefato de release.

## Evals do Azy Agent

O `bun run check` é determinístico e nunca chama provider de LLM. A qualidade,
segurança e completude das respostas do Azy Agent são medidas pela suíte de
evals, que roda o harness real (prompt + provider + tools + banco seedado)
contra um dataset versionado em `apps/api/src/evals/datasets/`.

Cadência de execução (boas práticas de mercado):

- `bun run evals` — execução informal a qualquer momento, com relatório em
  `tmp/eval-reports/`. Sem credencial de provider, pula com aviso e sai com
  sucesso (nunca bloqueia o fluxo determinístico).
- `bun run evals:gate` — gate de release. Deve rodar a cada versão/tag
  (workflow `.github/workflows/evals.yml` dispara por tag `v*` ou manualmente).
  Aplica thresholds mínimos por dimensão (task completion, tool correctness,
  faithfulness, escopo, segurança, no-leak, recusa e alinhamento) e falha o
  release se qualquer dimensão ficar abaixo do corte. Sem credencial, falha
  com erro explícito — nunca aprova silenciosamente.
- O relatório guarda hash do dataset, modelo/provider, scores por dimensão e
  casos reprovados; a execução compara com o baseline anterior e avisa queda
  acima da margem de regressão (configurada em
  `apps/api/src/evals/config.ts`).

Variáveis de ambiente:

- `AZY_PROVIDER_API_KEY` (ou `OPENAI_API_KEY` / `OPENROUTER_API_KEY`)
- `AZY_EVAL_PROVIDER` — `OPENAI` (padrão) ou `OPENROUTER`
- `AZY_EVAL_MODEL` — modelo executado nos casos
- `AZY_EVAL_JUDGE_MODEL` — modelo do LLM-as-judge (critérios qualitativos)

Em máquina local, para rodar as evals com exatamente o mesmo modelo/credencial
que o Azy Agent já usa (armazenadas cifradas em `apps/api/dev.db`):

```bash
bun run evals:env  # gera apps/api/.env.evals a partir do banco local
bun run evals      # os scripts de eval carregam apps/api/.env.evals automaticamente
```

`apps/api/.env.evals` contém a chave decifrada e é coberto por `.gitignore`
(`.env.*`); nunca comitar nem compartilhar. Regenerate com `evals:env` quando a
credencial ou o modelo forem trocados na aplicação.

Para filtrar a suíte durante o desenvolvimento verificação iterativa:

```bash
bun run evals --filter hierarchy-batch
bun run evals --dry-run  # lista casos sem chamar o provider
```

Como adicionar um caso de eval: crie uma entrada tipada `EvalCase` em
`apps/api/src/evals/datasets/core.ts` com mensagem do usuário, `setup`
(itens seedados), expectativas determinísticas (`expectedTools`,
`assertState`, `mustNotCallTools`) e, quando não houver ground truth,
`qualitativeLints` com critérios curtos e explícitos. O caso entra na suíte
automaticamente e no hash do dataset.

## Instalações Publicadas

Para validar uma instalação publicada, informe a URL base do ambiente:

```bash
SMOKE_URL=https://example.com/app bun run test:smoke
```

O resultado esperado é HTTP `200` para a aplicação e HTTP `401` para
`/api/auth/me` sem sessão.

O teste de integração da API usa banco SQLite em memória e pode ser executado
no mesmo ambiente de runtime, desde que os arquivos de teste estejam presentes
na imagem ou no workspace:

```bash
bun run test:integration
```

O seed de desenvolvimento também não aceita mais uma senha padrão. Se for
necessário executá-lo, informe uma senha temporária somente pelo ambiente:

```bash
SEED_ADMIN_PASSWORD='senha-local-temporaria' bun run db:seed
```

Procedimentos específicos de host, containers, domínios internos, SSH e
persistência devem ser mantidos na documentação privada da infraestrutura, fora
deste repositório.
