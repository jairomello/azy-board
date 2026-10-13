# syntax=docker/dockerfile:1
# Imagem da API do Azy Board (perfis SIMPLE e ADVANCED — mesma imagem).
#
# A versão do Bun DEVE espelhar o arquivo `.bun-version` da raiz; a coerência
# entre `.bun-version`, este ARG e o workflow do CI é verificada por
# `bun run check:deploy-versions`.
#
# Subcomandos do entrypoint: `api` (padrão, sem auto-migração), `migrate`
# (job de rollout) e `setup` (provisionamento inicial de tenant/admin).
# Ver docker/entrypoint-api.sh e DEPLOY.md.

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
COPY packages/mcp-protocol/package.json packages/mcp-protocol/
COPY packages/tool-registry/package.json packages/tool-registry/
COPY packages/tool-execution/package.json packages/tool-execution/
COPY packages/types/package.json packages/types/
COPY packages/ui-contracts/package.json packages/ui-contracts/
RUN bun install --frozen-lockfile

# --- Build ------------------------------------------------------------------
FROM deps AS build
COPY . .
WORKDIR /app/apps/api
# T60: gera a versão do build antes de montar a API. Sem .git no contexto da
# imagem, o contador cai para 1 na data do build; AZYBOARD_BUILD_NUMBER pode
# ser informado pelo pipeline.
RUN bun run /app/scripts/build-version.ts
# index.js é o servidor; migrate.js e migrate-pg.js são os runners de migration
# dos perfis SIMPLE e ADVANCED, usados pelo subcomando `migrate` do entrypoint.
# worker.js é a entrada dedicada do worker de runs (T37, perfil ADVANCED/SEPARATE),
# sem listener HTTP.
#
# `--external sharp` em TODAS as entradas (mesmo tratamento do `bun run build`):
# o sharp é nativo e resolve o binário da plataforma com `require` dinâmico de
# `@img/sharp-<platform>-<arch>`, que só existe aninhado em
# `node_modules/sharp/node_modules/`. Ao inlinar o sharp no bundle, esse require
# passa a ser resolvido a partir de `dist/` e falha com "Could not load the
# "sharp" module using the linuxmusl-x64 runtime" — derrubando a inicialização
# de qualquer módulo do grafo que o importe (ex.: routes/users -> avatarImage).
RUN bun run build \
  && bun build src/db/migrate.ts --outfile dist/migrate.js --target bun --external sharp \
  && bun build src/db/postgres/migrate.ts --outfile dist/migrate-pg.js --target bun --external sharp \
  && bun build src/scripts/setup.ts --outfile dist/setup.js --target bun --external sharp \
  && bun build src/worker.ts --outfile dist/worker.js --target bun --external sharp

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
    UPLOADS_DIR=/app/uploads \
    AZYBOARD_SKILL_DIR=/app/skills/azyboard
# O linker isolado do Bun mantém o store em node_modules/.bun e symlinks por
# workspace (apps/api/node_modules); copiar ambos é necessário para resolver
# dependências nativas em runtime (sharp/@img).
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules apps/api/node_modules
COPY --from=prod-deps /app/package.json ./package.json
COPY --from=build /app/packages ./packages
# Skill oficial embarcada para download em Minha conta (change official-skill-download);
# o caminho precisa casar com AZYBOARD_SKILL_DIR definido no ENV abaixo.
COPY --from=build /app/skills/azyboard ./skills/azyboard
COPY --from=build /app/apps/api/package.json apps/api/package.json
COPY --from=build /app/apps/api/dist apps/api/dist
# T60: versão do build embarcada na imagem, lida pela rota pública GET /version.
COPY --from=build /app/.build-info.json ./.build-info.json
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
