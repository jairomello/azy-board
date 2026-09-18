## 1. Fundação de lint e versão do Bun

- [x] 1.1 Criar `.bun-version` com a versão de Bun usada pelo projeto e documentar seu uso
- [x] 1.2 Adicionar a dependência de lint (Biome, licença MIT) ao `package.json` e criar o arquivo de configuração com o preset recomendado, ignorando artefatos gerados (`dist`, snapshots de migration)
- [x] 1.3 Substituir `scripts/lint.ts` (que hoje só repete o typecheck) por lint real e reprovativo
- [x] 1.4 Ajustar os scripts do `package.json`: garantir que `check` inclua o lint real e adicionar `test:migrations` explícito
- [x] 1.5 Corrigir as violações de lint encontradas e registrar no config qualquer regra desativada com justificativa

## 2. Workflow de CI

- [x] 2.1 Criar `.github/workflows/ci.yml` com disparo em push de branches e pull requests
- [x] 2.2 Implementar o job `check`: `bun install --frozen-lockfile` e `bun run check`
- [x] 2.3 Implementar o job `contracts`: `check:i18n`, `test:mcp-catalog`, `test:agent-skill` e `test:migrations`
- [x] 2.4 Implementar o job `smoke`: subir API (3001) e Web (5173) e rodar `test:smoke` com `AZYBOARD_API_TARGET`
- [x] 2.5 Configurar cache de dependências do Bun e usar a versão do `.bun-version` no setup
- [x] 2.6 Publicar logs/artefatos úteis em caso de falha sem expor segredos

## 3. Documentação e proteção de branch

- [x] 3.1 Criar `docs/ci.md` com visão dos jobs, como reproduzir cada gate localmente e como interpretar falhas
- [x] 3.2 Referenciar o fluxo de CI no `README.md` e/ou `DEPLOY.md`
- [x] 3.3 Documentar a decisão para trabalho solo: o CI roda no push como sinal de qualidade e os required checks obrigatórios ficam opcionais (sem proteção de branch nesta iteração)

## 4. Verificação

- [x] 4.1 Rodar `bun run check` localmente e confirmar typecheck + lint real + testes + build
- [x] 4.2 Reproduzir localmente os gates de contrato (`check:i18n`, `test:mcp-catalog`, `test:agent-skill`, `test:migrations`)
- [x] 4.3 Rodar `bun run test:smoke` com API e Web no ar
- [ ] 4.4 Validar o CI no push da branch e confirmar os jobs `check`, `contracts` e `smoke` verdes no GitHub Actions
- [ ] 4.5 Validar `openspec validate` da change e registrar o vínculo e o fechamento no card do board
