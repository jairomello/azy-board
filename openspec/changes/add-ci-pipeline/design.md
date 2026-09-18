## Context

O repositório é um monorepo Bun com `apps/api`, `apps/web`, `apps/mcp` e `packages/types`. O script `check` encadeia `typecheck`, `lint`, `bun test` e `build`. O `lint` atual (`scripts/lint.ts`) apenas repete o `typecheck`, então não há análise estática real. Existe um único workflow em `.github/workflows/evals.yml`, disparado por tag `v*` e manual, focado no gate de evals do Azy Agent — não há CI para branches ou pull requests. A validação hoje é manual e depende do operador lembrar de rodar typecheck, testes, build, i18n, migrations, catálogo MCP e skill de agente. O projeto já possui verificadores prontos (`check:i18n`, `test:mcp-catalog`, `test:agent-skill`, `test:smoke`, testes de migration) que só precisam ser encadeados.

## Goals / Non-Goals

**Goals:**

- Garantir que todo push de branch e pull request execute typecheck, lint real, testes, build e gates de contrato antes do merge.
- Tornar o resultado do CI obrigatório e reprovativo, com diagnóstico útil.
- Substituir o lint no-op por lint real usando dependência com licença permitida.
- Fixar a versão do Bun para reprodutibilidade e documentar como reproduzir os gates localmente.

**Non-Goals:**

- Rodar os evals do Azy Agent em pull requests (exigem chave de provider e já têm workflow próprio por tag).
- Orçamento de bundle e otimização de chunks (Item 23, change separada).
- Publicação, deploy automático ou release (tratados em outra frente).
- Migração de SQLite para PostgreSQL (decisão do Item 9).

## Decisions

### Ferramenta de lint: Biome

Adotar **Biome** (MIT) como linter real, substituindo o corpo no-op de `scripts/lint.ts` por `biome check`. Justificativa: binário único, rápido, com regras para TypeScript/JS/JSON, sem cadeia de plugins, compatível com Bun. Alternativas consideradas: **ESLint** (mais regras, porém mais lento e pesado com `typescript-eslint` e plugins) e **oxlint** (rápido, mas somente lint e com menos cobertura). Como o projeto não usa nenhuma ferramenta hoje, Biome entrega o melhor custo/benefício sem ampliar muito a superfície.

### Rollout do lint em código legado

O lint real pode encontrar muitas violações iniciais. A decisão é configurar o Biome com o preset recomendado, corrigir o que for mecânico e restringir com `ignore`/overrides apenas arquivos gerados (`dist`, snapshots de migration, artefatos). Não usar `warn` para esconder problemas: o gate precisa falhar. Se um conjunto de regras for inviável agora, desativar pontualmente a regra com justificativa no config, registrando o débito — em vez de rebaixar para aviso.

### Estrutura do workflow: jobs separados por custo

Um workflow `ci.yml` com três jobs:

1. `check` — `bun install --frozen-lockfile`, `bun run check` (typecheck + lint + testes + build).
2. `contracts` — gates de contrato: `check:i18n`, `test:mcp-catalog`, `test:agent-skill` e teste de migration.
3. `smoke` — sobe API e Web e roda `test:smoke` (`200` na raiz, `401` na rota de sessão).

Jobs em paralelo reduzem o tempo total; `check` é o gate principal. Alternativa considerada: um único job sequencial (mais simples, porém mais lento e sem paralelismo). O `evals.yml` permanece como está.

### Versão do Bun fixada

Adicionar `.bun-version` no repositório e usar `oven-sh/setup-bun` com leitura do arquivo de versão. Alternativa: usar `latest` (reprodutibilidade pior) ou instalar manualmente (mais passos). O arquivo também documenta a versão esperada para uso local via `bun upgrade`.

### Smoke test no CI

Subir a API na porta 3001 e o Web na 5173 no job `smoke`, exportando `AZYBOARD_API_TARGET=http://localhost:3001` para o script `scripts/smoke.ts`, exatamente como no fluxo local validado. Alternativa: direcionar ao proxy de produção (não determinístico e acoplado a ambiente).

### Required checks e proteção de branch

A configuração de proteção de branch é externa ao repositório. Decisão: documentar em `docs/ci.md` (ou seção equivalente) os nomes exatos dos jobs que devem ser marcados como obrigatórios na branch principal, além de linkar a partir do `README.md`/`DEPLOY.md`. Alternativa: usar arquivo versionado de configuração de branch (não suportado de forma nativa pelo GitHub).

## Risks / Trade-offs

- **Lint real gera muitas violações e trava merges** → configurar preset recomendado, corrigir o mecânico nesta change, restringir gerados e desativar regras inviáveis com justificativa explícita.
- **CI lento em runner gratuito** → dividir em jobs paralelos e cachear dependências do Bun; manter o `check` como job crítico.
- **Smoke test instável por portas ocupadas** → usar portas fixas documentadas e aguardar readiness antes de rodar o script.
- **Divergência com a versão do Bun local** → `.bun-version` como fonte única, referenciada no workflow e na documentação.
- **Proteção de branch não versionada** → documentar nomes de jobs e checklist de configuração; validar que o PR mostra os checks obrigatórios.
- **Licença de dependência** → Biome é MIT; nenhuma dependência AGPL/GPL/BSL será introduzida.

## Migration Plan

1. Adicionar `.bun-version` e a configuração do Biome.
2. Substituir `scripts/lint.ts` por lint real e ajustar `package.json` (incluir `test:migrations` no `check` se necessário).
3. Criar `.github/workflows/ci.yml` com os jobs `check`, `contracts` e `smoke`.
4. Corrigir violações de lint e validar `bun run check` localmente.
5. Documentar o fluxo e configurar os required checks na branch principal.
6. Rollback: reverter o workflow e a configuração de lint; o `check` volta ao comportamento anterior sem impacto em dados.

## Open Questions

- Os required checks devem incluir todos os jobs (`check`, `contracts`, `smoke`) ou apenas `check` na primeira iteração? Recomendação: incluir os três, começando por `check` e adicionando os demais à medida que estabilizarem.
- O teste de migration deve virar script dedicado (`test:migrations`) ou basta a cobertura de `bun test`? Recomendação: script dedicado explícito no job `contracts` para diagnóstico claro.
