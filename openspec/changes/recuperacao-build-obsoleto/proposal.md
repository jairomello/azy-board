# Proposal

## Why

Quando um build novo é publicado, abas que já estavam abertas continuam com o
JavaScript antigo em memória. O primeiro clique que carrega um chunk sob demanda
(ex.: `BoardPage`, `ProjectPlanningFields`, `AttachmentThumbnail`) pede um
arquivo com hash que não existe mais no servidor.

O nginx do web trata qualquer caminho inexistente com
`try_files $uri $uri/ /index.html`, então responde **`index.html` com status 200
e `Content-Type: text/html`** para um `.js` ou `.css` ausente. Como
`X-Content-Type-Options: nosniff` está ativo e o navegador faz verificação
estrita de MIME para módulos, o import dinâmico falha, o CSS é recusado e o
`AppErrorBoundary` mostra "Erro de renderização". O mesmo acontece depois que a
sessão expira: `redirectToLogin` navega para `/login`, e se o `index.html` vier
do cache heurístico (o nginx não envia `Cache-Control` para HTML) a página volta
apontando para os hashes antigos.

O botão "Tentar novamente" não resolve porque só limpa o estado do boundary —
o `React.lazy` mantém a promise rejeitada em cache. Hoje o usuário precisa
descobrir sozinho que deve recarregar com cache limpo.

## What Changes

- **nginx**: assets com hash de conteúdo passam a ter cache longo e **404 real**
  quando o arquivo não existe (`try_files $uri =404`), sem cair no fallback do
  SPA; `index.html` passa a ser sempre revalidado, para que uma navegação não
  reutilize HTML de build antigo.
- **Recuperação automática**: falha de import dinâmico/pré-carregamento
  (`vite:preloadError`, "Failed to fetch dynamically imported module", "Importing
  a module script failed", "Loading chunk ... failed") dispara **um** reload da
  página, com trava de repetição em `sessionStorage` e flag por carregamento
  para não entrar em loop quando a falha persiste.
- **ErrorBoundary**: erro de build obsoleto deixa de mostrar "Erro de
  renderização" genérico e passa a explicar que a versão publicada mudou,
  oferecendo "Recarregar página" de verdade; o botão de retry dos demais erros
  continua igual.
- **Aviso de nova versão**: o app compara periodicamente a versão embutida no
  bundle com `GET /api/version` (rota pública existente), também ao voltar o
  foco para a aba. Quando há build novo, exibe um aviso não bloqueante com ação
  de recarregar, integrável ao shell e à tela de login.
- Em `dev` (versão `dev`) a checagem e o aviso ficam desligados.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `build-version`: detecção de build publicado mais novo em aba aberta e
  recuperação automática de build obsoleto.
- `integrated-app-shell`: aviso de nova versão disponível na interface.
- `reproducible-deploy`: cache dos estáticos e resposta 404 para asset ausente.

## Impact

- `docker/nginx-web.conf.template` e `docker/nginx-web-cloudflare.conf.template`:
  novas locations de `/assets/` e `/index.html`; headers de segurança continuam
  herdados do `server` (nenhum `add_header` novo nessas locations).
- `apps/web/src/lib/staleBuild.ts` (novo), `components/BuildUpdateNotice.tsx`
  (novo), `components/AppErrorBoundary.tsx`, `main.tsx`, `App.tsx`,
  `lib/buildInfo.ts` e as três traduções (`common`).
- Sem mudança de contrato REST, MCP, banco ou migration. A rota `/version` e
  `/api/version` já existem e são públicas.
- Testes: unidade de detecção/trava, componente do aviso, boundary com erro de
  chunk, contrato dos dois templates nginx e ajuste do teste existente do
  boundary.
