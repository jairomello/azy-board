# Tasks

## 1. Cache e 404 real no nginx

- [x] 1.1 Adicionar em `docker/nginx-web.conf.template` e `docker/nginx-web-cloudflare.conf.template` a location `/assets/` com `try_files $uri =404` e `expires 1y`, sem `add_header` que descarte os headers de segurança herdados, verificando com teste de contrato dos dois templates.
- [x] 1.2 Adicionar `location = /index.html` com `expires -1` nos dois templates, verificando no teste de contrato que o HTML não é cacheável sem revalidação.
- [x] 1.3 Conferir que o fallback do SPA continua servindo rotas profundas (`/projects/:id/board`) e que os headers CSP/nosniff seguem presentes nas respostas de `/assets/`.

## 2. Recuperação de build obsoleto no web

- [x] 2.1 Criar `apps/web/src/lib/staleBuild.ts` com detecção das mensagens de falha de chunk, reload único com janela de 20 s em `sessionStorage` e flag por carregamento, verificando com teste unitário as mensagens dos três motores, a trava de repetição e o storage indisponível.
- [x] 2.2 Instalar o listener de `vite:preloadError` no bootstrap (`main.tsx`) e verificar no teste da lib que o evento dispara `preventDefault` e o reload.
- [x] 2.3 Ajustar `AppErrorBoundary` para reconhecer erro de chunk, tentar o reload automático e, quando a trava bloquear, mostrar mensagem de build desatualizado com botão "Recarregar página", mantendo o retry dos demais erros, verificando com testes de componente.
- [x] 2.4 Adicionar as chaves de i18n do boundary (título, mensagem e ação) em pt-BR, en e es e verificar com `bun run check:i18n`.

## 3. Aviso de nova versão

- [x] 3.1 Expor em `lib/buildInfo.ts` a busca da versão publicada por `api.get('/version')` com `cache: 'no-store'` e a comparação `isUpdateAvailable`, sem quebrar o uso de `dev`.
- [x] 3.2 Criar `components/BuildUpdateNotice.tsx` com checagem ao montar, intervalo de 5 min e rechecagem em `visibilitychange`, renderizando aviso não bloqueante com ação de recarregar e dispensa, verificando com teste de componente os cenários de build novo, build igual, `dev` e aba oculta.
- [x] 3.3 Montar o aviso em `App.tsx` fora das rotas, para aparecer também na tela de login, verificando que o layout do shell não muda quando não há aviso.
- [x] 3.4 Adicionar as chaves de i18n do aviso em pt-BR, en e es e verificar com `bun run check:i18n`.

## 4. Verificação e documentação

- [x] 4.1 Rodar `bun run check` e `bun run test:smoke`, registrando qualquer falha ambiental separadamente de regressão da change.
- [x] 4.2 Validar `bun run openspec:validate` e `bun run check:docs`.
- [x] 4.3 Documentar em `DEPLOY.md` a política de cache dos assets e o 404 real, e registrar a correção no `CHANGELOG.md`, verificando com `bun run check:docs`.

## Workflow follow-up

- Arquivar a change após o merge e a validação dos artefatos.
