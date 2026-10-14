# Proposal

## Why

Em produção o rodapé da sidebar mostra **"Versão dev"** em vez da versão publicada (e o mesmo texto aparece na tela de login). O comportamento não é do ambiente: a versão nunca chega ao bundle.

Diagnóstico, com evidências do ambiente publicado:

1. **O bundle do web não recebe a versão.** `Dockerfile.web` roda `bun run build` dentro de `apps/web` (apenas `tsc -b && vite build`); o `build:version` da raiz nunca roda, nenhum build arg de versão é passado e `.build-info.json` é *gitignored* — ausente tanto no checkout do CI quanto no clone da VPS do labapps. Sem `AZYBOARD_BUILD_VERSION` nem arquivo, `apps/web/vite.config.ts` cai no fallback `'dev'` e `__BUILD_DATE__` em vazio. Confirmado por inspeção: nem o bundle de `azyboard.jairo.tools` nem o do labapps contêm a string `2026.10.14.*`, e `GET /version` na origem devolve o HTML do SPA.
   A imagem da API faz o certo (`Dockerfile` roda `scripts/build-version.ts` e copia `.build-info.json`), o que mostra que a falha é só do caminho do web.
2. **A API e o web podem publicar versões diferentes do mesmo build.** Dentro da imagem não há `.git` (`.dockerignore` exclui), então o contador `N` do `build-version` cai para `1` fixo — dois builds no mesmo dia recebem a mesma versão, contrariando o requisito "Builds seguintes no mesmo dia" — e o web (sem versão alguma) e a API (versão calculada no build) divergem. Para "identificar qual build está publicado" é preciso uma fonte única por execução de build.
3. **O endpoint público de versão está inalcançável no produto.** A rota é montada na raiz (`app.route('/version', versionRouter)`) e documentada como `GET /version`, mas as duas variantes de nginx da imagem web só encaminham `/api/`, `/uploads/`, `/ws` e `/mcp`; `/version` cai no `try_files ... /index.html`. Resultado medido: `https://azyboard.jairo.tools/version` responde `200 text/html` (o app), não o JSON da versão. O labapps tem o mesmo comportamento.

## What Changes

- **Embutir a versão e a data do build no bundle do web** também quando o build acontece na imagem (`Dockerfile.web`), passando a receber os build args de versão e repassá-los ao Vite antes do `vite build`.
- **Fonte única de versão por execução do pipeline**: o CI calcula a versão uma vez (com `.git` disponível) e injeta `AZYBOARD_BUILD_VERSION`/`AZYBOARD_BUILD_DATE` nas imagens de API e web do mesmo commit, de modo que as duas reportem **a mesma** `YYYY.MM.DD.N` e o contador não fique travado em `1`.
- **Manter a versão coerente no build local**: o fallback por `.build-info.json` continua valendo em dev, e o `'dev'` fica restrito a execução de desenvolvimento — nenhum artefato publicado pode cair nele.
- **Tornar o endpoint público de versão alcançável pela origem do app**: manter `GET /version` e passar a responder também em `GET /api/version` (alias), com proxy nas duas variantes de nginx da imagem web (`nginx-web.conf.template` e `nginx-web-cloudflare.conf.template`) e no proxy de desenvolvimento do Vite.
- **Guarda estrutural**: estender `bun run check:deploy-versions` para reprovar quando os Dockerfiles ou o workflow de publicação de imagens deixarem de transportar a versão do build.

**Fora de escopo:** mudar o formato `YYYY.MM.DD.N`, a origem da contagem (commits do dia), o texto/posicionamento na interface (sidebar e login continuam como estão), a rota de versões de projeto (`version-management`) e o fluxo de deploy por si só.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `build-version`: a versão passa a ser resolvida uma vez por execução de build e transportada para os artefatos de API **e** web (sem fallback `dev` em artefato publicado, contador não travado), e o endpoint público de versão passa a ser alcançável pela mesma origem que serve o app, em `/version` e `/api/version`.

## Impact

**Build e empacotamento**
- `Dockerfile.web`: `ARG`/`ENV` de `AZYBOARD_BUILD_VERSION` e `AZYBOARD_BUILD_DATE` antes do `vite build`.
- `Dockerfile`: passa a respeitar os build args de versão (hoje calcula por conta própria dentro da imagem, sem `.git`).
- `.github/workflows/ci.yml` (job `publish-production-images`): calcular a versão uma vez e passá-la às duas imagens.
- `scripts/check-deploy-versions.ts`: nova verificação de que a versão do build é transportada.

**API**
- `apps/api/src/index.ts`: montar o mesmo `versionRouter` também em `/api/version` (a rota `/version` permanece).

**Web e proxy**
- `apps/web/vite.config.ts`: proxy de desenvolvimento para `/version`.
- `docker/nginx-web.conf.template` e `docker/nginx-web-cloudflare.conf.template`: `location = /version` encaminhando para o upstream da API.
- `apps/web/src/lib/buildInfo.ts`: sem mudança de código (o fallback `dev` segue para dev/testes), mas passa a receber valor real no build de imagem.

**Documentação**
- `docs/build-version.md`: documentar os dois caminhos do endpoint e a injeção da versão pelo pipeline.

**Sem impacto**
- Formato da versão, migrations, banco, contratos de API existentes, telas e i18n do rótulo "Versão".
