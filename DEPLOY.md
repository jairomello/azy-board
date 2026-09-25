# Deploy path-based

Este monorepo suporta publicação em subpath (path-based) atrás de um proxy
reverso. Em dev local (`bun run dev:api` e `bun run dev:web`), roda normalmente
em `/` nas portas padrão (Vite em :5173, Hono em :3000).

## Como funciona

Quando um proxy reverso publica o app em um subpath, ele injeta
`window.__BASE_PATH__="/app/"` no HTML antes
de entregar para o browser. O `apps/web/src/main.tsx` lê essa variável
e:

1. **Fetch interceptor**: reescreve `fetch("/api/...")` para
   `fetch("/app/api/...")`.
2. **React Router basename**: `<BrowserRouter basename={...}>` ajusta as
   rotas para o subpath.
3. **Redirect 401** (`apps/web/src/lib/api.ts`): quando a sessão expira,
   o redirect para `/login` usa `__BASE_PATH__` para apontar para o
   login dentro do subpath.

Em dev local, `window.__BASE_PATH__` não é definido, então o código roda como
se estivesse em `/`.

## Como publicar em path-based

O frontend não contém um prefixo de produção hardcoded. O build aceita a
variável `AZYBOARD_BASE_PATH`; em desenvolvimento, quando ela não existe, o
Vite usa paths relativos. Em uma publicação sob `/app/`, o ambiente de build
deve definir `AZYBOARD_BASE_PATH=/app/`.

O deploy usa 2 containers:

- `azyboard-web` (nginx:alpine) servindo o build estático do Vite.
- `azyboard-api` (oven/bun:1-alpine) rodando Hono + Drizzle.

Configurar o proxy reverso para encaminhar a API, a aplicação e o WebSocket:

1. `/app/api/` → `azyboard-api:3000`, com rewrite
   `^/app/api/(.*)$ /api/$1 break`.
2. `/app/` → `azyboard-web:80`, com rewrite
   `^/app/(.*)$ /$1 break` + sub_filter injetando
   `window.__BASE_PATH__="/app/"`.

3. `/app/ws` → `azyboard-api:3000`, com rewrite para `/ws` e suporte a
   upgrade WebSocket HTTP/1.1.

## Variáveis de ambiente (produção)

- `NODE_ENV=production`.
- `PORT=3000` (api).
- `DATABASE_URL=/data/azyboard.db` (SQLite via Drizzle).
- `MIGRATIONS_DIR=/app/migrations` (path onde o Dockerfile move o
  diretório `apps/api/src/db/migrations`).
- `FRONTEND_URL=https://example.com/app/` (origem permitido pelo CORS).
- `JWT_SECRET`: segredo para assinar o cookie de sessão.

Os valores de domínio, host, caminhos privados e credenciais devem ser
configurados somente na infraestrutura do ambiente, nunca neste repositório.
O código da aplicação permanece portável entre raiz (`/`), subpaths e outros
domínios.

## Perfis de instalação

O Azy Board suporta dois perfis de instalação, escolhidos **uma única vez** no
setup de cada instalação. A escolha é permanente: para usar o outro perfil é
preciso uma nova instalação com banco e volume novos.

### SIMPLE (padrão)

- **Banco:** SQLite local (arquivo).
- **Serviços externos:** nenhum (sem PostgreSQL, sem Redis).
- **Capacidade:** recomendado para até aproximadamente 20 pessoas.
- **Produção pequena:** suportada com volumes persistentes e backups configurados.
- **Configuração:** veja `apps/api/.env.example.simple`.
- **Docker:** veja `docker-compose.simple.yml`.

### ADVANCED

- **Banco:** PostgreSQL 16+.
- **Coordenação:** Valkey (BSD) ou Redis-compatível.
- **Capacidade:** suporta mais usuários; instância única de API.
- **Configuração:** veja `apps/api/.env.example.advanced`.
- **Docker:** veja `docker-compose.advanced.yml`.

#### Limites operacionais do ADVANCED

- **Instância única de API:** múltiplas instâncias/HA não são suportadas até
  que a fila/worker do agente (Item 4), a reconciliação do board (Item 20) e
  os controles distribuídos restantes sejam implementados.
- **Capacidade orientativa:** aproximadamente 20+ pessoas com uma instância.
  Não é uma restrição de conta nem uma promessa de desempenho.
- **Valkey é a referência comunitária** Redis-compatível (licença BSD). O
  cliente `ioredis` (MIT) funciona com qualquer servidor Redis-compatível.

#### Migração de dados entre perfis

**Dados não são migrados entre perfis.** Se você testou em SQLite e quer usar
ADVANCED, faça uma nova instalação e comece do zero. Se tem dados de produção
que quer preservar, conduza um projeto de migração externo, fora do produto.

O produto não fornece comando de importação, ferramenta de conversão, cutover
SQLite → PostgreSQL nem rollback PostgreSQL → SQLite. Migrations de schema
dentro do perfil escolhido continuam existindo normalmente.

## CI antes do deploy

Todo push de branch e pull request passa pelo CI
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) com os jobs `check`,
`contracts` e `smoke`. Não publique uma versão com gate reprovado. Para
reproduzir localmente e para configurar os required checks, veja
[`docs/ci.md`](docs/ci.md).
