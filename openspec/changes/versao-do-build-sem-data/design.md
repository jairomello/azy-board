# Design

## Context

Ver `proposal.md` (Why) para a motivação. Estado atual relevante:

- A versão é embutida no bundle web pelo Vite (`__APP_VERSION__`/`__BUILD_DATE__`,
  `apps/web/vite.config.ts`) e lida por um ponto único, `apps/web/src/lib/buildInfo.ts`
  (`getBuildInfo()`), consumido em `AppShell.tsx` e `LoginPage.tsx`.
- Os dois pontos de exibição alternam entre `common:buildVersion` e
  `common:buildVersionWithDate` conforme `buildInfo.buildDate` esteja preenchido.
- A API resolve a mesma informação em `apps/api/src/buildInfo.ts` e a serve em
  `/version` e `/api/version`; `scripts/check-deploy-versions.ts` exige que os
  Dockerfiles e o workflow transportem versão **e** data.
- `apps/web/src/app-shell-layout-contract.test.ts` é um contrato estrutural
  (`[CONTRATO-ESTRUTURAL]`) que hoje afirma a presença de `tCommon('buildVersionWithDate'`
  no shell.

## Goals / Non-Goals

**Goals:**

- Uma única forma de exibir a versão no produto (só o número), nos dois pontos, sem
  condicional de data.
- Não mexer no contrato de build, no pipeline nem no endpoint público.

**Non-Goals:**

- Remover `__BUILD_DATE__`, `AZYBOARD_BUILD_DATE`, `.build-info.json` ou o campo
  `buildDate` do endpoint `/version`.
- Mudar a regra de numeração, o contador por dia ou a resolução única por build.
- Exibir a data em outro lugar (ferramenta de diagnóstico, página de conta).

## Decisions

**1. Mudar só a exibição; o transporte da data permanece.**
A data do build ainda é o dado que o pipeline injeta, que `check:deploy-versions`
verifica e que o endpoint público expõe para diagnóstico de qual build está publicado —
é o que permite responder "esta imagem é a do commit X?" sem abrir o repositório.
Remover o transporte seria uma mudança de contrato de deploy (Dockerfile, workflow, CI)
muito maior do que o pedido, que é de apresentação.
*Alternativa:* apagar `buildDate` do bundle, do `.build-info.json` e da resposta de
`/version` — descartada; quebraria `check:deploy-versions` e os consumidores do
endpoint, sem ganho para o usuário.

**2. Um único formato de exibição, sem condicional.**
O JSX passa a renderizar sempre `tCommon('buildVersion', { version })`, sem o ternário
sobre `buildDate`. Isso elimina a possibilidade de os dois pontos divergirem e mantém
`data-build-version` (âncora usada por testes e por verificação de deploy) intacta.
*Alternativa:* manter a condicional invertida (mostrar só o número quando houver data) —
descartada; não haveria caso em que exibir a data fizesse sentido.

**3. Remover a chave `buildVersionWithDate` dos três idiomas.**
Chave sem uso é conteúdo morto e o gate `check:i18n` cobra paridade entre locales; a
remoção é feita nos três arquivos para não deixar `extra` em nenhum idioma.
*Alternativa:* manter a chave "para o futuro" — descartada; reintroduzir é uma linha.

**4. O contrato estrutural do shell acompanha a mudança.**
`app-shell-layout-contract.test.ts` afirma exatamente o que a mudança retira, então o
teste passa a exigir `tCommon('buildVersion'` e a **ausência** de
`buildVersionWithDate` no shell. A cobertura comportamental de que a data não aparece
mesmo estando no bundle entra em teste de componente, com `getBuildInfo` mockado
devolvendo `buildDate` preenchido.

## Risks / Trade-offs

- **Perder a data de build de vista na operação** → mitigado pela decisão 1: o endpoint
  público segue devolvendo a data, e `docs/build-version.md` continua documentando onde
  consultá-la.
- **Teste estrutural desatualizado passando a falhar** → tratado explicitamente pela
  decisão 4, na mesma entrega.
- **Divergência entre o que os testes de dev veem (`dev`, sem data) e a produção** → o
  teste de componente com `getBuildInfo` mockado cobre o caminho de produção com data
  preenchida, que hoje nenhum teste de tela exercita.

## Migration Plan

Sem migração de dados nem de schema; a mudança é só de apresentação no web. Rollback =
reverter o commit do web (a chave de tradução e o ternário voltam juntos).
