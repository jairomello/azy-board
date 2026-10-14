# Tasks

## 1. Transporte da versão nos artefatos publicados

- [x] 1.1 Declarar `AZYBOARD_BUILD_VERSION` e `AZYBOARD_BUILD_DATE` como build args em `Dockerfile.web` e repassá-los ao Vite (`ENV`) antes do `vite build`; verificar construindo a imagem com `--build-arg AZYBOARD_BUILD_VERSION=2026.10.14.9 --build-arg AZYBOARD_BUILD_DATE=2026-10-14` e conferindo que a versão aparece no bundle servido (`grep` no `index-*.js` extraído do container)
- [x] 1.2 Declarar os mesmos build args em `Dockerfile`, mantendo o cálculo interno (`scripts/build-version.ts` + `.build-info.json`) como fallback para build local; verificar rodando a imagem com os args e chamando `GET /version`, que deve devolver a versão injetada
- [x] 1.3 Fazer o job `publish-production-images` calcular a versão uma vez (`bun run scripts/build-version.ts --json`) e injetá-la como `build-args` nas imagens de API e web; verificar inspecionando o job e confirmando que os dois `docker/build-push-action` recebem os mesmos valores
- [x] 1.4 Estender `scripts/check-deploy-versions.ts` para reprovar quando um Dockerfile de artefato publicado deixar de declarar/repassar a versão do build e quando o job de publicação deixar de calculá-la e injetá-la; verificar com `bun run check:deploy-versions` verde no repositório e vermelho ao remover temporariamente o `ARG` (restaurar em seguida)
- [x] 1.5 Garantir que o fallback de desenvolvimento segue restrito a dev/testes; verificar com `bun test apps/web/src/lib/buildInfo.test.ts` e `bun test scripts/build-version.test.ts`

## 2. Endpoint público de versão alcançável

- [x] 2.1 Montar o mesmo `versionRouter` também em `/api/version`, mantendo `/version`; verificar com teste novo em `apps/api/src/integration.test.ts` que os dois caminhos respondem `200` com a mesma versão e data, sem sessão
- [x] 2.2 Adicionar `location = /version` (casamento exato) encaminhando para o upstream da API nas duas variantes de nginx (`docker/nginx-web.conf.template` e `docker/nginx-web-cloudflare.conf.template`); verificar subindo a imagem web com a API e conferindo que `GET /version` pela porta da web devolve JSON, não o HTML do app
- [x] 2.3 Adicionar o proxy de `/version` ao `server.proxy` do `vite.config.ts` para o comportamento de dev espelhar o de deploy; verificar com o web em dev no ar que `GET /version` responde o JSON da versão
- [x] 2.4 Documentar em `docs/build-version.md` os dois caminhos do endpoint e a injeção da versão pelo pipeline, incluindo o motivo de o fallback `dev` nunca valer em artefato publicado; verificar com `bun run check:docs`

## 3. Verificação de integração e publicação

- [x] 3.1 Rodar `bun run check` (typecheck, lint, fronteiras, testes e build) e corrigir o que aparecer
- [ ] 3.2 Após a publicação, confirmar no ambiente publicado que o rodapé da sidebar e a tela de login exibem `YYYY.MM.DD.N` com a data do build, e que `GET /version` e `GET /api/version` na origem do produto respondem JSON com a mesma versão do SHA publicado

## Workflow follow-up

- Arquivar a change após a revisão; as outras duas changes abertas mexem em `project-planning-modal`, sem conflito com `build-version`.
- Registrar no Azy Board um card para o incidente "produção exibindo Versão dev" se quiser rastrear a correção até o deploy.
