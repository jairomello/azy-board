## Why

Hoje não existe CI obrigatório para branches e pull requests: quem valida typecheck, testes, build, i18n, migrations e catálogo MCP é a memória de quem executa localmente. Isso é arriscado porque API, Web, MCP, wiki e OpenSpec precisam permanecer sincronizados, e o comando `lint` atual apenas repete o typecheck, sem lint real.

## What Changes

- Criar workflow de CI em `.github/workflows` disparado em push de branches e pull requests, com job obrigatório que executa `bun run check` (typecheck + lint + testes + build).
- Adicionar gates complementares ao check: verificação de i18n (`check:i18n`), testes de migration, catálogo MCP (`test:mcp-catalog`), smoke test com API + Web e teste da skill de agente (`test:agent-skill`).
- Substituir o `lint` atual (que só repete o typecheck) por lint real, com regras explícitas e configuradas; falha de lint deve reprovar o CI.
- Bloquear merge quando contratos de tipos, catálogo MCP, i18n ou migrations divergirem, via required status checks na branch principal (documentado e configurável).
- Documentar o fluxo de CI (como rodar localmente, como interpretar falhas e como reproduzir o ambiente) e registrar a versão do Bun fixada.

## Capabilities

### New Capabilities
- `continuous-integration`: validação automática e obrigatória de branches e pull requests cobrindo typecheck, lint real, testes, build, i18n, migrations, catálogo MCP, smoke test e skill de agente, com bloqueio de merge em divergência de contratos.

### Modified Capabilities
<!-- Nenhuma capacidade existente tem requisitos alterados: o gate de i18n já existe (Item 22) e os contratos atuais permanecem válidos. -->

## Impact

- **CI/CD:** `.github/workflows/*.yml` (novo workflow de CI; `evals.yml` permanece inalterado).
- **Scripts:** `package.json` (`lint`, novo `test:migrations`/agregação de check), `scripts/lint.ts`, possivelmente configuração de lint nova.
- **Dependências:** ferramenta de lint real (MIT/Apache/ISC) + lockfile e versão do Bun fixada.
- **Documentação:** `DEPLOY.md`, `README.md` e/ou `docs/` com o fluxo de CI e required checks.
- **Processo:** regras de proteção de branch (configuração externa ao repositório, documentada).
- **Rastreabilidade:** Board ref: b4286151-3860-4aeb-abe8-2e42baca68af (card Item 5).
