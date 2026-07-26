# Deploy path-based

Este monorepo suporta publicação em subpath (path-based) atrás de um
proxy reverso — ex.: `https://example.com/azyboard/` no
homelab do Jairo. Em dev local (`bun run dev:api` e `bun run dev:web`),
roda normalmente em `/` nas portas padrão (Vite em :5173, Hono em :3000).

## Como funciona

Quando o Nginx Proxy Manager (ou outro proxy) publica o app em um
subpath, ele injeta `window.__BASE_PATH__="/azyboard/"` no HTML antes
de entregar para o browser. O `apps/web/src/main.tsx` lê essa variável
e:

1. **Fetch interceptor**: reescreve `fetch("/api/...")` para
   `fetch("/azyboard/api/...")`.
2. **React Router basename**: `<BrowserRouter basename={...}>` ajusta as
   rotas para o subpath.
3. **Redirect 401** (`apps/web/src/lib/api.ts`): quando a sessão expira,
   o redirect para `/login` usa `__BASE_PATH__` para apontar para o
   login dentro do subpath.

Em dev local, `window.__BASE_PATH__` não é definido, então o `if (BASE_PATH)`
é falso e o código roda como se estivesse em `/`.

## Como publicar em path-based

O deploy usa 2 containers:

- `azyboard-web` (nginx:alpine) servindo o build estático do Vite.
- `azyboard-api` (oven/bun:1-alpine) rodando Hono + Drizzle.

Configurar o proxy reverso com 2 Custom Locations:

1. `/azyboard/api/` → `azyboard-api:3000`, com rewrite
   `^/azyboard/api/(.*)$ /api/$1 break`.
2. `/azyboard/` → `azyboard-web:80`, com rewrite
   `^/azyboard/(.*)$ /$1 break` + sub_filter injetando
   `window.__BASE_PATH__="/azyboard/"`.

## Variáveis de ambiente (produção)

- `NODE_ENV=production`.
- `PORT=3000` (api).
- `DATABASE_URL=/data/azyboard.db` (SQLite via Drizzle).
- `MIGRATIONS_DIR=/app/migrations` (path onde o Dockerfile move o
  diretório `apps/api/src/db/migrations`).
- `FRONTEND_URL=https://example.com/azyboard/` (origem
  permitido pelo CORS).
- `JWT_SECRET`: segredo para assinar o cookie de sessão.
