## Why

A maior parte dos testes de frontend (24 dos ~38 arquivos em `apps/web/src`) apenas verifica se uma string existe no código-fonte. Esse estilo gera falsos positivos — uma implementação incorreta passa enquanto mantiver a string — e falsos negativos — uma refatoração semanticamente correta quebra o teste. O projeto não tem ambiente DOM, testes de componente nem cobertura de jornadas críticas no navegador: o E2E Playwright existente cobre só 4 passos e não roda no CI. O resultado é baixa confiança de regressão no frontend justamente nas áreas mais sensíveis (board, realtime, permissões, agente).

## What Changes

- Introduzir infraestrutura de testes de componente no web (DOM via `happy-dom` + Testing Library) com setup reutilizável e matchers de acessibilidade.
- Ampliar os testes de **comportamento** de hooks/adapters/model (sem DOM), consolidando o padrão já iniciado em `features/board/model`, `features/project-settings/model` e `lib/`.
- Migrar os testes de texto-fonte para testes de comportamento; remover os que apenas checam presença de string e manter somente contratos estruturais que não têm equivalente comportamental viável (com justificativa no arquivo).
- Ampliar o E2E Playwright para jornadas críticas: login, Board (criar, mover e reordenar cards por drag), Settings (colunas/squads/módulos), permissões (RBAC por papel) e Azy Agent com provider determinístico (sem chamar LLM real).
- Adicionar regressão visual das telas críticas, com baselines versionados, tolerância documentada e regeneração em ambiente controlado.
- Integrar as novas suítes ao fluxo de verificação (`bun run check`, `test:regression`) e ao CI como gates.
- Documentar a estratégia de testes de frontend em `TESTING.md`.

## Capabilities

### New Capabilities
- `frontend-testing`: Estratégia e infraestrutura de testes do frontend web — comportamento de hooks/adapters/model sem DOM, testes de componente com DOM, E2E de navegador para jornadas críticas, jornada determinística do Azy Agent, regressão visual e política de uso de testes de contrato estrutural (texto-fonte).

### Modified Capabilities
- `continuous-integration`: o CI passa a executar as suítes de frontend (componente e E2E de navegador) como gates obrigatórios, além dos gates já existentes.

## Impact

- `apps/web`: novas devDependencies (`happy-dom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`), arquivo de setup de teste, migração/remoção dos 24 `*-contract.test.ts` de texto-fonte e novos testes de comportamento/componente.
- `e2e/`: ampliação das jornadas, helpers de autenticação/permissão e suíte de regressão visual.
- `apps/api`: seam de provider determinístico do Azy Agent acessível apenas em modo de teste, para viabilizar a jornada de agente no E2E sem credencial de LLM.
- `scripts/` e `package.json`: novos scripts (`test:web`, `test:e2e`, `test:visual`) e atualização de `check` e `test:regression`.
- `.github/workflows/ci.yml`: novo job de frontend E2E/visual e execução da suíte de componentes.
- `TESTING.md`: documentação da estratégia e da política de contratos estruturais.
- Sem impacto no comportamento de produção; mudanças de runtime restritas ao modo de teste.
