# syntax=docker/dockerfile:1
# Imagem da API do Azy Board (perfis SIMPLE e ADVANCED — mesma imagem).
#
# A versão do Bun DEVE espelhar o arquivo `.bun-version` da raiz; a coerência
# entre `.bun-version`, este ARG e o workflow do CI é verificada por
# `bun run check:deploy-versions`.
#
# Subcomandos do entrypoint: `api` (padrão, sem auto-migração) e `migrate`
# (job separado de rollout). Ver docker/entrypoint-api.sh e DEPLOY.md.

ARG BUN_VERSION=1.3.14

# --- Dependências do workspace (cacheável) ---------------------------------
FROM oven/bun:${BUN_VERSION}-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/mcp/package.json apps/mcp/
COPY packages/api-contracts/package.json packages/api-contracts/
COPY packages/assistant-contracts/package.json packages/assistant-contracts/
COPY packages/domain/package.json packages/domain/
COPY packages/realtime-contracts/package.json packages/realtime-contracts/
COPY packages/tool-registry/package.json packages/tool-registry/
COPY packages/types/package.json packages/types/
COPY packages/ui-contracts/package.json packages/ui-contracts/
RUN bun install --frozen-lockfile

# --- Build ------------------------------------------------------------------
FROM deps AS build
COPY . .
WORKDIR /app/apps/api
# index.js é o servidor; migrate.js e migrate-pg.js são os runners de migration
# dos perfis SIMPLE e ADVANCED, usados pelo subcomando `migrate` do entrypoint.
RUN bun run build \
  && bun build src/db/migrate.ts --outfile dist/migrate.js --target bun \
  && bun build src/db/postgres/migrate.ts --outfile dist/migrate-pg.js --target bun

# --- Apenas dependências de produção (sharp e demais externas do bundle) ---
FROM deps AS prod-deps
RUN rm -rf node_modules && bun install --frozen-lockfile --production

# --- Runtime ----------------------------------------------------------------
FROM oven/bun:${BUN_VERSION}-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    MIGRATIONS_DIR=/app/migrations \
    PG_MIGRATIONS_DIR=/app/migrations-pg \
    UPLOADS_DIR=/app/uploads
# O linker isolado do Bun mantém o store em node_modules/.bun e symlinks por
# workspace (apps/api/node_modules); copiar ambos é necessário para resolver
# dependências nativas em runtime (sharp/@img).
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules apps/api/node_modules
COPY --from=prod-deps /app/package.json ./package.json
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/api/package.json apps/api/package.json
COPY --from=build /app/apps/api/dist apps/api/dist
# Migrations embarcadas na imagem: mudanças de schema são revisadas junto com
# a imagem em cada commit (fonte única de verdade do deploy).
COPY --from=build /app/apps/api/src/db/migrations ./migrations
COPY --from=build /app/apps/api/src/db/postgres/migrations ./migrations-pg
COPY docker/entrypoint-api.sh /usr/local/bin/entrypoint-api.sh
RUN chmod +x /usr/local/bin/entrypoint-api.sh \
  && mkdir -p /app/uploads /data \
  && chown -R bun:bun /app/uploads /data
USER bun
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/entrypoint-api.sh"]
# `api` nunca aplica migrations implicitamente; o rollout roda o job `migrate`
# antes do start (ver DEPLOY.md — Rollout, rollback e backup).
CMD ["api"]
