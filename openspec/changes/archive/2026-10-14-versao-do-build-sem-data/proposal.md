# Proposal

## Why

A regra de numeração do build é `YYYY.MM.DD.N` (ver `openspec/specs/build-version/`):
a data já está dentro do número da versão. Mesmo assim a interface exibe
`Versão 2026.10.14.3 · 2026-10-14`, repetindo a data duas vezes na mesma linha — no
rodapé da barra lateral do shell e no canto da tela de login. Além de redundante, a
data ocupa espaço num rodapé estreito e sugere que versão e data são informações
distintas.

O número da versão já identifica o build (e a data dele); a data só é útil quando
alguém quer os bytes crus, e para isso existe o endpoint público `/version`.

## What Changes

- Exibir **somente o número da versão** (`Versão YYYY.MM.DD.N`) nos dois pontos de
  exibição: rodapé da barra lateral do shell e canto da tela de login.
- Remover a alternância de formato que acrescenta a data (`buildVersionWithDate`) e a
  chave de tradução correspondente nos três idiomas.
- Manter **intacta** a produção e o transporte da data do build: `.build-info.json`,
  `AZYBOARD_BUILD_DATE`, o `__BUILD_DATE__` do bundle, o endpoint público `/version`
  e `/api/version` continuam devolvendo `{ version, buildDate }`, assim como a
  verificação `check:deploy-versions`.
- Ajustar a documentação (`docs/build-version.md`) e o contrato estrutural do shell que
  hoje afirmam que a versão é sempre exibida acompanhada da data.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `build-version`: o requisito **"Formato da versão do build"** deixa de exigir que a
  versão seja acompanhada da data onde é exibida; o requisito **"Exposição da versão
  ao frontend e à API"** passa a dizer que o frontend exibe apenas o número da versão,
  enquanto a data continua sendo produzida, transportada e devolvida pelo endpoint
  público para diagnóstico.

## Impact

**Web**
- `apps/web/src/components/AppShell.tsx`: o rodapé da sidebar passa a renderizar
  `buildVersion` sem condicional de data.
- `apps/web/src/pages/LoginPage.tsx`: o mesmo no canto da tela de login.
- `apps/web/src/i18n/locales/{pt-BR,en,es}/common.json`: remoção da chave
  `buildVersionWithDate`, mantendo a paridade entre idiomas.
- Testes: `apps/web/src/app-shell-layout-contract.test.ts` (contrato estrutural que hoje
  exige a chave `buildVersionWithDate`) e cobertura de que a data não é exibida mesmo
  quando presente no bundle.

**Documentação**
- `docs/build-version.md`: a seção "Como conferir a versão publicada" e a frase que
  afirma que a versão é sempre acompanhada da data nos pontos onde é exibida.

**Sem impacto**
- `scripts/build-version.ts`, `apps/api/src/buildInfo.ts`, `apps/api/src/routes/version.ts`,
  `apps/web/vite.config.ts`, Dockerfiles e `.github/workflows/ci.yml`: a data continua
  sendo gerada, transportada e servida pelo endpoint público.
- `scripts/check-deploy-versions.ts`: segue exigindo o repasse de versão **e** data.

**Rastreabilidade:** nenhum card do Azy Board vinculado a esta change (Board ref:
nenhum).
