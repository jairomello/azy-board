# Tasks — add-reproducible-deploy

## 1. Dockerfiles e entrypoint

- [x] 1.1 Criar `.dockerignore` na raiz (excluir `dev.db`, `*.db`, `uploads/`, `tmp/`, `node_modules/`, `.git/`, `openspec/`, docs privadas)
- [x] 1.2 Criar `Dockerfile` (API) multi-stage com `ARG BUN_VERSION` (default de `.bun-version`): estágio de deps com `bun install --frozen-lockfile` no workspace, estágio de build com `bun run build:api` e cópia de `apps/api/src/db/migrations` para `/app/migrations`, estágio de runtime com usuário não-root e `MIGRATIONS_DIR=/app/migrations`
- [x] 1.3 Criar entrypoint da API com subcomandos `api` (sobe o servidor sem migração) e `migrate` (aplica migrations e encerra), usado como `ENTRYPOINT`/`CMD` da imagem
- [x] 1.4 Criar `Dockerfile.web` (nginx): estágio de build do Vite com build arg `AZYBOARD_BASE_PATH` (default `/`) e estágio `nginx:alpine` servindo o estático com os headers de segurança documentados
- [x] 1.5 Resolver dependências nativas da imagem (ex.: `sharp`) no base alpine ou documentar/migrar a base para `debian-slim` equivalente

## 2. Compose files por perfil

- [x] 2.1 Adicionar serviço `web` (build `Dockerfile.web`) em `docker-compose.simple.yml` e `docker-compose.advanced.yml`, com `AZYBOARD_BASE_PATH` como build arg
- [x] 2.2 Adicionar serviço one-shot `migrate` (mesma imagem da API, comando `migrate`) nos dois compose files; no ADVANCED, `depends_on: postgres: condition: service_healthy`
- [x] 2.3 Fazer o serviço da API depender de `migrate: condition: service_completed_successfully` e remover qualquer auto-migração implícita do start em produção
- [x] 2.4 Conferir healthchecks, volumes (`uploads`, dados) e variáveis de perfil (SIMPLE/ADVANCED) nos dois compose files após a reestruturação

## 3. Backup e restore

- [x] 3.1 Criar `scripts/deploy-backup.ts` (SIMPLE: `VACUUM INTO` do SQLite + marcador/volume de uploads; ADVANCED: `pg_dump` via compose + uploads) e expor `bun run deploy:backup`
- [x] 3.2 Criar `scripts/deploy-restore.ts` (restore em instância/volume limpos, os dois perfis) e expor `bun run deploy:restore`
- [x] 3.3 Criar `scripts/deploy-test-restore.ts` (orquestra compose efêmero: migrar, popular, backup, destruir volume, restaurar, verificar integridade) e expor `bun run test:restore`

## 4. CI

- [x] 4.1 Criar job `image` em `.github/workflows/ci.yml`: validar compose files (`docker compose config`), build de `Dockerfile` e `Dockerfile.web` com cache do GHA e execução de `bun run test:restore`
- [x] 4.2 Criar verificação de coerência `.bun-version` × `ARG BUN_VERSION`/tags dos Dockerfiles × workflow, reprovando em divergência
- [x] 4.3 Atualizar `docs/ci.md` com o novo job e instrução de torná-lo required check

## 5. Documentação

- [x] 5.1 Reescrever no `DEPLOY.md` a seção de topologia/variáveis para referenciar os arquivos versionados (remover dependências do Dockerfile externo, ex.: origem de `MIGRATIONS_DIR`)
- [x] 5.2 Adicionar no `DEPLOY.md` a seção "Rollout, rollback e backup": ordem backup → migration → up, regras de compatibilidade aplicação × schema, rollback por imagem anterior e quando restaurar backup, com aviso **BREAKING** da remoção da auto-migração no start
- [x] 5.3 Documentar pré-requisito Docker Compose v2 e o uso dos scripts `deploy:backup`, `deploy:restore` e `test:restore` nos dois perfis

## 6. Verificação

- [x] 6.1 Rodar `bun run check` e `bun run test:smoke`
- [x] 6.2 Build local das duas imagens e `docker compose -f docker-compose.simple.yml up -d` em clone limpo, validando migration como job separado e `/health/ready`
- [x] 6.3 Executar `bun run test:restore` e validar o fluxo de rollback documentado (imagem anterior + restore de backup)
- [x] 6.4 No ADVANCED, validar `docker compose -f docker-compose.advanced.yml up -d` com migration como job e backup/restore via `pg_dump` — Ressalva: migration como job (0000–0002) e backup/restore via `pg_dump`/`psql` validados; o `up -d` não mantém a API saudável porque o adapter PostgreSQL do runtime da aplicação ainda não existe (`apps/api/src/db/index.ts` — iniciativa `[DB-SWAP]`, fora do escopo desta change). Teste automatizado de restore roda no perfil SIMPLE (CI); o ADVANCED será coberto quando o adapter existir.

Board ref: e931a564-15c9-462d-8472-76157262ac28

Board ref: e931a564-15c9-462d-8472-76157262ac28
