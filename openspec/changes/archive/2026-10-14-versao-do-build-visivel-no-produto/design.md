# Design

## Context

Ver `proposal.md` para o diagnóstico. Fatos que moldam a solução:

- `apps/web/vite.config.ts` resolve a versão assim, nesta ordem: `process.env.AZYBOARD_BUILD_VERSION` → `AZYBOARD_BUILD_VERSION` via `loadEnv(..., 'AZYBOARD_')` → `.build-info.json` na raiz → `'dev'`. `apps/api/src/buildInfo.ts` usa `AZYBOARD_BUILD_VERSION`/`AZYBOARD_BUILD_DATE` → `.build-info.json` → `'dev'`.
- `Dockerfile` (API) já roda `scripts/build-version.ts` no build e copia `.build-info.json`; `Dockerfile.web` não roda nada disso e não recebe args de versão.
- `.dockerignore` exclui `.git` e não exclui `.build-info.json` (que é *gitignored*, logo ausente no CI e no clone do host de deploy).
- O nginx da imagem web encaminha `/api/`, `/uploads/`, `/ws` (exato) e `/mcp` (exato) para o upstream; tudo o mais cai em `try_files ... /index.html`. A rota da API é montada na raiz (`app.route('/version', versionRouter)`).
- `scripts/check-deploy-versions.ts` já lê `Dockerfile`, `Dockerfile.web` e `.github/workflows/ci.yml` para verificar a versão do Bun — é o lugar natural para guardar também a versão do build.

## Goals / Non-Goals

**Goals:**

- Versão publicada visível no produto (sidebar e login) exatamente com o `YYYY.MM.DD.N` + data do build.
- Uma única resolução de versão por build, compartilhada por API e web.
- Versão legível de fora pela mesma origem do app.

**Non-Goals:**

- Mudar o formato, a origem da contagem (commits do dia UTC) ou o texto exibido na interface.
- Versionar a imagem em tempo de runtime (a versão continua embutida no artefato).
- Rotear por `/api/` tudo o que hoje vive fora dele (apenas a versão ganha alias).

## Decisions

**1. O pipeline resolve a versão uma vez e injeta nas duas imagens.**
No job `publish-production-images`, `bun run scripts/build-version.ts --json` (com `.git` disponível) produz `{ version, buildDate }`, e esses dois valores vão como `build-args` para `Dockerfile` e `Dockerfile.web`. Assim a API e o web do mesmo SHA reportam a mesma versão e o contador deixa de travar em `1` (que é o que acontece hoje dentro da imagem, sem `.git`).
*Alternativas descartadas:* (a) deixar cada imagem calcular — mantém contador travado e permite divergência entre API e web; (b) gerar `.build-info.json` no workspace do CI e depender do `COPY . .` — funciona por acidente, depende de arquivo *gitignored* e não existe no clone do host de deploy (que é como o labapps constrói).

**2. `Dockerfile.web` recebe e repassa a versão ao Vite.**
`ARG AZYBOARD_BUILD_VERSION`/`ARG AZYBOARD_BUILD_DATE` + `ENV` correspondentes antes do `vite build` (build args não entram no ambiente do `RUN` sozinhos). O `vite.config.ts` já lê essas variáveis, então nenhuma mudança é necessária no frontend: o fallback `'dev'` continua existindo, mas só é alcançável em dev/testes.
*Trade-off:* a camada do `vite build` é invalidada a cada versão nova — o cache de dependências (`bun install`) permanece e o custo é o build do frontend, que já acontece a cada publicação.

**3. `Dockerfile` da API aceita os mesmos args, mantendo o cálculo interno como fallback.**
`resolveApiBuildInfo()` já prioriza `AZYBOARD_BUILD_VERSION`; a imagem continua funcionando quando construída sem args (build local), mas no pipeline passa a usar a versão injetada, idêntica à do web.

**4. Endpoint: manter `/version` e acrescentar o alias `/api/version`.**
Montar o mesmo `versionRouter` em `/api/version` aproveita o proxy que as duas variantes de nginx já fazem para `/api/`, sem depender de configuração nova; e somar `location = /version` (casamento exato, para não capturar assets com prefixo parecido) cobre quem usa o caminho documentado. No dev, o mesmo proxy entra no `server.proxy` do Vite para que o comportamento não divirja do deploy.
*Alternativas descartadas:* mover a rota para `/api/version` apenas (quebra o contrato documentado); usar `location /version` como prefixo (mais abrangente do que o necessário).

**5. Guarda estrutural no `check:deploy-versions`.**
O script já inspeciona os dois Dockerfiles e o workflow: passa a reprovar quando faltar o `ARG`/repasse da versão no `Dockerfile.web` (e no `Dockerfile`) ou quando o job de publicação deixar de calcular e injetar a versão. É a verificação barata que impede a regressão silenciosa que originou este bug.
*Alternativa descartada:* só testar por asserção de string em teste isolado — o script já é o ponto único de coerência de deploy e roda no `check` do CI.

**6. Documentação com os dois caminhos.**
`docs/build-version.md` passa a descrever `GET /version` e `GET /api/version` e a injeção da versão pelo pipeline, para que a próxima pessoa não reintroduza o `dev`.

## Risks / Trade-offs

- **Build de imagem sem args produzir `'dev'`** → aceito para dev; o pipeline sempre injeta e o `check:deploy-versions` reprova se o repasse desaparecer.
- **Cache de buildx invalidado a cada publicação** → custo restrito à etapa do `vite build`; o cache de dependências continua válido.
- **Divergência entre a contagem do CI e do host de deploy** → a versão passa a vir só do CI; deploys que constroem no host (labapps) recebem a versão pela mesma injeção e caem no fallback de arquivo/`dev` apenas se construídos fora do pipeline, o que é aceitável e visível no rodapé.
- **`location = /version` em publicação path-based** → o proxy reverso externo normaliza o prefixo antes do nginx; validar em `/azyboard/version` no labapps.

## Migration Plan

Sem migração de dados. Publicação: um build novo do CI gera imagens com a versão embutida e o proxy novo; o rodapé passa a exibir a versão na primeira publicação seguinte. Rollback = voltar a tag anterior da imagem (o comportamento volta a "Versão dev", sem outro efeito).
