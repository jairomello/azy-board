## Context

O frontend web (`apps/web`) tem ~38 arquivos de teste, dos quais 24 verificam apenas se uma string existe no código-fonte via `fetch(new URL('./Componente.tsx', import.meta.url))`. Esses testes de contrato estrutural não exercitam renderização, estado, eventos, rede ou acessibilidade. Já existem testes de comportamento puros (ex.: `features/board/board-interaction.test.ts`, `features/project-settings/settings-behavior.test.ts`, `lib/*.test.ts`) que extraem lógica para módulos `model/` testáveis — esse é o padrão a consolidar. Não há ambiente DOM, testes de componente, nem cobertura E2E ampla: `e2e/regression.ts` cobre login, criação de projeto, criação de módulo e exclusão de coluna, e não roda no CI.

O runner é `bun test` (raiz, descobre `*.test.ts` em todos os workspaces), o E2E usa a biblioteca `playwright` (Apache-2.0) sob Bun com um harness próprio, e o CI (`.github/workflows/ci.yml`) tem os jobs `check`, `contracts` e `smoke`, sem etapa de navegador.

Restrições: código e documentação em PT-BR; dependências apenas MIT/Apache-2.0/BSD/ISC/domínio público; nada de regressão no runtime de produção; o Azy Agent depende de provider LLM externo e não pode ser chamado de verdade no CI.

## Goals / Non-Goals

**Goals:**
- Tornar o comportamento observável do frontend a unidade primária de teste, com confiança de regressão.
- Cobrir com E2E de navegador as jornadas críticas: login, Board (criar/mover/reordenar por drag), Settings, permissões (RBAC) e Azy Agent (determinístico).
- Detectar regressões visuais nas telas críticas.
- Reduzir os testes de texto-fonte ao mínimo justificável, com política explícita.
- Integrar as suítes ao fluxo local (`check`/`regression`) e ao CI como gates.

**Non-Goals:**
- Reescrever toda a suíte em um único estilo ou atingir meta arbitrária de cobertura percentual.
- Testar o comportamento real do LLM (isso pertence à suíte de evals existente).
- Substituir testes de backend/MCP.
- Introduzir runner de testes concorrente (Vitest, Jest ou `@playwright/test`).
- Cobrir visualmente telas instáveis ou dependentes de dados externos.

## Decisions

### 1. DOM e testes de componente: happy-dom + Testing Library
Adotar `happy-dom` + `@testing-library/react` + `@testing-library/user-event` + `@testing-library/jest-dom` (todas MIT) em `apps/web` devDependencies. Alternativas consideradas: `jsdom` (mais pesado e mais lento, também MIT), `vitest`+`jsdom` (exigiria um segundo runner concorrente ao `bun test`) e `@playwright/experimental-ct` (pesado e acoplado ao navegador para testes unitários). A escolha mantém o runner único (`bun test`) e roda rápido.

### 2. Setup de DOM por arquivo, não global
O registro do DOM e dos matchers ficará em `apps/web/src/test/setup.ts`, importado explicitamente no topo de cada teste de componente. Alternativa considerada: preload global via `bunfig.toml` — rejeitada porque injetaria `window`/`document` em testes de API e MCP, aumentando custo e risco de interferência. Um script `test:web` focado ajuda no ciclo de desenvolvimento, mas os testes continuam descobertos por `bun test`.

### 3. Separar lógica testável de renderização
Lógica de negócio e transformação de dados devem viver em módulos `model/` sem dependência de React, testados como funções puras/injetadas. Testes com DOM ficam reservados para renderização, interação, acessibilidade e integração com hooks. Isso acelera a suíte e reduz flakiness.

### 4. E2E mantém a biblioteca `playwright` sob Bun
Ampliar o harness existente (`e2e/`) em vez de migrar para o runner `@playwright/test`. Motivo: o runner oficial é orientado a Node e tem suporte experimental sob Bun; introduzir um segundo runner contraria o Non-Goal. As jornadas serão modularizadas e o stack descartável (SQLite temporário + API + web) reaproveitado.

### 5. Jornada do Azy Agent com provider determinístico no servidor
Adicionar um provider de teste determinístico selecionado por variável de ambiente (ex.: `AZY_AGENT_PROVIDER=stub`) na composição da rota do assistente, reutilizando o seam `provider` já injetável em `AssistantHarness`. O provider de stub SHALL ser inacessível quando `NODE_ENV=production`. Alternativa considerada: interceptar requisições no navegador — rejeitada porque o navegador não fala com o LLM; o stub precisa ficar no processo da API para exercitar harness, autorização e persistência.

### 6. Regressão visual com comparação de screenshots versionada
Usar `page.screenshot()` + `pixelmatch` (ISC) + `pngjs` (MIT), com baselines em `e2e/__screenshots__/`, viewport fixo, tema fixo e dados de seed determinísticos. Tolerância por pixel e razão máxima de diferença configuráveis; regeneração por flag (`E2E_UPDATE_SNAPSHOTS=1`). Alternativas: `toHaveScreenshot` do `@playwright/test` (rejeitado junto com o runner) e serviços SaaS de visual testing (rejeitados por dependência externa e licenciamento). Escopo inicial restrito a um conjunto pequeno e estável de telas (login, projects, board, settings, dashboard).

### 7. Política para testes de texto-fonte
Cada `*-contract.test.ts` de texto-fonte será triado em: (a) migrado para teste de comportamento/componente/E2E; (b) mantido como contrato estrutural somente se verificar invariante não comportamental (ex.: cobertura de chaves i18n, fronteiras de módulo) e com comentário justificando; ou (c) removido por redundância. Nenhum contrato será removido antes do teste substituto estar verde. Uma verificação leve sinaliza novos testes que apenas leem o fonte sem justificativa.

### 8. Integração ao CI sem duplicar o `check`
Como os testes de componente são descobertos por `bun test`, `bun run check` já os executa. O CI ganha um job dedicado de E2E de navegador (e visual) com Chromium do sistema, reaproveitando o stack descartável e publicando screenshots/traces em caso de falha. `test:regression --with-e2e` passa a incluir a bateria completa.

## Risks / Trade-offs

- [happy-dom diverge do navegador real] → E2E Playwright cobre as jornadas críticas em navegador real; testes de componente focam interação e acessibilidade, não layout pixel-perfect.
- [Regressão visual instável entre ambientes (fontes/OS)] → baselines gerados no mesmo container do CI (ubuntu-latest + Chromium do sistema), escopo reduzido, tolerância configurada e regeneração explícita; começar como observação e só então tornar bloqueante.
- [E2E lento e flaky] → stack descartável isolado, esperas determinísticas por elemento/rota, dados de seed controlados, retry limitado e timeouts explícitos.
- [Stub do agente divergir do provider real] → o stub cobre apenas a jornada de UI; o comportamento do harness segue coberto pelos testes de API e pela suíte de evals.
- [Migração de 24 arquivos é grande] → faseamento; nenhum contrato é removido sem substituto verde, permitindo rollback incremental.
- [Custo de manutenção das baselines] → conjunto pequeno e estável, documentado em `TESTING.md`.

## Migration Plan

1. Infraestrutura: adicionar devDependencies, `apps/web/src/test/setup.ts` e script `test:web`; migrar 2–3 contratos representativos para validar o padrão.
2. Migrar os demais testes de texto-fonte de maior valor (board/realtime, item modal, visibilidade de projeto, mutações otimistas, cache) para comportamento/componente.
3. Ampliar o E2E de navegador e introduzir o provider determinístico do agente.
4. Introduzir regressão visual no escopo estável.
5. Conectar `check`/`test:regression`/CI e documentar em `TESTING.md`.

Rollback: reverter o job de CI, os scripts e as dependências; os testes novos são aditivos e a remoção de contratos é incremental.

## Open Questions

- Tornar a regressão visual bloqueante já nesta change ou iniciar em modo observação até as baselines estabilizarem? (proposta: observação na primeira execução, bloqueante depois de estabilizada).
- Adotar `@playwright/test` como runner de E2E em uma change futura, quando o suporte a Bun amadurecer?
- O guard contra novos testes de texto-fonte deve ser um script de verificação no CI ou apenas convenção documentada?
