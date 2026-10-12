# Design — build-version-numbering

## Context

Ver `proposal.md` para motivação. Estado atual relevante:

- Não existe versão de aplicação. O `package.json` raiz não declara `version`, o
  `CHANGELOG.md` usa `[Unreleased]` e o deploy usa tags de imagem
  `sha-<40 hex>` (`compose` com `AZYBOARD_IMAGE_TAG`, `scripts/check-deploy-versions.ts`
  valida apenas a versão do Bun).
- O web é buildado por Vite (`apps/web/vite.config.ts`) com `base` relativo e um
  `loadEnv(mode, '.', 'AZYBOARD_')`; já existe o padrão de injetar valores em
  runtime via `window.__BASE_PATH__` no proxy reverso. O bundle é servido pelo
  container web.
- A API (Bun + Hono) monta rotas em `apps/api/src/index.ts` e tem rotas de saúde
  públicas em `/health` (`health.ts`). A tela de login (`LoginPage.tsx`) e a
  sidebar (`AppShell.tsx`, bloco com `connectedWork`) são os pontos de exibição.

## Goals / Non-Goals

- **Goals**: numeração `YYYY.MM.DD.N` gerada no build; exibir versão + data no
  login e na sidebar; expor a versão por endpoint público; manter o pipeline
  associando a versão aos artefatos.
- **Non-Goals**: adotar SemVer de produto, tags git, release notes automáticas ou
  versionamento de API; alterar o esquema de tags de imagem do deploy existente.

## Decisions

### D1 — Fonte única de geração: `scripts/build-version.ts`

Um script versionado calcula a versão a partir do repositório e da data do
build:

- `date` = data do build em UTC (`YYYY.MM.DD`), para determinismo entre máquinas/CI.
- `N` = `max(1, git rev-list --count --since="<date>T00:00:00Z" HEAD)` — conta os
  commits do dia, reinicia em `1` a cada dia e é reproduzível para o mesmo
  commit/data, sem arquivo de estado.
- Um override `AZYBOARD_BUILD_NUMBER` permite que o CI injete o número da run
  quando desejado, sem quebrar o formato.

Alternativas consideradas: (a) `N = GITHUB_RUN_NUMBER` — é global e não reinicia
por dia, contrariando o requisito; (b) contador em arquivo versionado — exigiria
edição manual e conflitos de merge; (c) SemVer manual em `package.json` —
rejeitado pelo usuário em favor de data + contador.

### D2 — Propagação para web, API e imagens

O `bun run build` raiz executa a geração **antes** dos builds e propaga o valor:

- **Web**: o `vite.config.ts` define, via `define`, `__APP_VERSION__` e
  `__BUILD_DATE__` a partir das variáveis geradas; em dev, caem para `dev`/vazio.
  Um helper `apps/web/src/lib/buildInfo.ts` lê esses globais.
- **API**: a geração produz um valor embutido (env `AZYBOARD_BUILD_VERSION`/
  `AZYBOARD_BUILD_DATE` injetada no build/`bun build --define` ou um arquivo de
  build copiado para `dist`), lido por uma rota pública.
- **Imagens/CI**: o pipeline executa a geração como etapa própria; a mesma versão
  alimenta o bundle web e a API da imagem publicada. Falha na etapa reprova o
  build.

Alternativa considerada: ler somente em runtime no proxy/`window` — rejeitada
porque a API precisa da versão sem depender do frontend e o login deve exibi-la
sem sessão.

### D3 — Endpoint público de versão

Adicionar rota pública `GET /version` (ao lado de `/health`, sem autenticação)
retornando `{ version, buildDate }`, sem segredos. Reaproveita o padrão de rotas
públicas já existente. Alternativa: estender `/health` — rejeitada para não
acoplar informação de build aos probes de liveness/readiness.

### D4 — Pontos de exibição e i18n

- `LoginPage`: rodapé/canto fixo com "vX · <data>", usando `buildInfo`.
- `AppShell`: no bloco `mt-auto` da sidebar, acrescentar uma linha abaixo de
  `connectedWork` com a versão e a data (visível na largura estendida).
- Novas chaves de i18n em PT-BR/EN/ES nos namespaces de `auth`/`common`,
  validadas por `check:i18n`.

## Risks / Trade-offs

- [Data em UTC difere do fuso do usuário na virada do dia] → documentado; o
  contador reinicia por dia UTC e a data exibida é a data do build.
- [Contagem por commits não reflete "builds" literalmente] → determinística e
  sem estado; override por env cobre o CI quando necessário.
- [Versão em cache no bundle] → a versão é embutida no build, então sempre
  corresponde ao artefato; sem novo cache a invalidar.
- [Endpoint público de versão] → retorna apenas versão/data; teste garante
  ausência de segredos.

## Migration Plan

Sem migração de banco. Deploy requer regenerar os builds para embutir a versão;
imagens antigas continuam exibindo o que foi buildado. Rollback = reverter o
commit. `bun run check`, `bun run test:smoke` e o pipeline de CI cobrem a
verificação.

## Open Questions

Nenhuma pendente que altere specs, abordagem ou tarefas.
