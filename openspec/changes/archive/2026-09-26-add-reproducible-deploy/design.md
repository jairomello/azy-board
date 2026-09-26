# Design — add-reproducible-deploy

## Context

Estado atual do deploy no repositório:

- `docker-compose.simple.yml` e `docker-compose.advanced.yml` declaram `build: {context: ., dockerfile: Dockerfile}`, mas **não existe `Dockerfile` no repositório**. Os arquivos reais de imagem são gerados por um preparador privado fora de revisão (`azyboard-post-deploy.py --prepare` no host de destino).
- Os compose versionados descrevem apenas o serviço da API (e, no ADVANCED, PostgreSQL/Valkey). A topologia real tem 2 containers (`azyboard-web` nginx + `azyboard-api`) conforme o `DEPLOY.md`, mas o serviço web não está em nenhum arquivo versionado.
- As migrations rodam embutidas na inicialização do container (`bun run db:migrate` junto com o start), não como etapa separada do rollout.
- O CI (`.github/workflows/ci.yml`) tem os jobs `check`, `contracts` e `smoke`, mas nunca builda as imagens Docker — nada prova que o deploy constrói a partir do clone.
- A versão do Bun é fixada em `.bun-version` (1.3.14) para dev/CI, mas a imagem de runtime usa tag flutuante (`oven/bun:1-alpine`) definida fora do repo.
- `DEPLOY.md` descreve variáveis (`MIGRATIONS_DIR=/app/migrations`) que dependem do layout interno do Dockerfile externo, e não documenta rollback nem compatibilidade entre versão da aplicação e do schema.
- O perfil SIMPLE deve continuar "subir com poucos comandos" (regra de produto do card de perfis de instalação); o ADVANCED mantém instância única de API.

Restrições: licenças apenas MIT/Apache-2.0/BSD/ISC/domínio público; docs e código em PT-BR; suportar os dois perfis (SIMPLE e ADVANCED) com a mesma base de imagens.

## Goals / Non-Goals

**Goals:**

- Qualquer pessoa com um clone público do repositório consegue buildar as imagens e subir os dois perfis com `docker compose`, sem arquivos externos.
- Código e infraestrutura mudam na mesma revisão: uma alteração em migration, Bun ou build entra com o Dockerfile correspondente no mesmo commit/PR.
- CI prova a reproduzibilidade: build das imagens + validação dos compose + teste de restore a cada push/PR.
- Rollout controlado: backup → migration (job separado) → start da API; rollback e compatibilidade app × schema documentados.

**Non-Goals:**

- Publicar imagens em registry (GHCR/Docker Hub) ou automatizar CD — fica para um follow-up; aqui o CI apenas builda.
- Kubernetes, HA ou múltiplas instâncias de API (limites operacionais do ADVANCED permanecem).
- Migração de dados entre perfis SIMPLE ↔ ADVANCED (fora de escopo por decisão do card de perfis).
- Reescrever o fluxo privado do labapps; apenas documentar o ajuste operacional necessário.
- Múltiplas arquiteturas (arm64) — imagens para a plataforma do host/runner por enquanto.

## Decisions

### D1. Infraestrutura versionada no próprio monorepo (não um repo de infra separado)

Um repo separado de infraestrutura mantém o drift de revisão que o card critica (código e Dockerfile mudam em PRs diferentes, sem garantia de coerência). Como o monorepo já versiona os compose files, os Dockerfiles passam a viver ao lado deles na raiz.

- **Alternativa rejeitada**: repo `azyboard-infra` versionado e testado — resolveria a parte "versionado", mas não a atomicidade de revisão com migrations/build.

### D2. Dois Dockerfiles na raiz: `Dockerfile` (API) e `Dockerfile.web` (nginx)

- `Dockerfile` (API): multi-stage com `oven/bun:<BUN_VERSION>` — estágio de deps (`bun install --frozen-lockfile` na raiz do workspace, incluindo `packages/*`), estágio de build (`bun run build:api` + cópia de `apps/api/src/db/migrations` para `/app/migrations`) e runtime com `node_modules` de produção, entrypoint e usuário não-root. O nome `Dockerfile` preserva a referência já usada nos compose files.
- `Dockerfile.web` (nginx): estágio de build do Vite (`bun run build:web` com build arg `AZYBOARD_BASE_PATH`, default `/`) + estágio `nginx:alpine` servindo o estático com os headers de segurança já documentados.
- Ambos usam `ARG BUN_VERSION` com default vindo de `.bun-version`, e `.dockerignore` na raiz para excluir `dev.db`, `uploads/`, `tmp/`, `node_modules/`.
- **Alternativa rejeitada**: imagem única servindo web pela API — contraria a topologia 2 containers já documentada e adotada em produção.

### D3. Fixar o Bun por `ARG BUN_VERSION` ancorado em `.bun-version`

A imagem usa tag exata (`oven/bun:1.3.14-alpine`), nunca `1-alpine`. O CI falha se o `ARG`/tag do Dockerfile divergir de `.bun-version` (check simples por script). Assim o bump de versão acontece em um único lugar revisável.

- **Alternativa rejeitada**: fixar por digest de imagem — mais restritivo, mas dificulta auditoria da versão e atualizações; a tag exata + coerência já entrega reproduzibilidade aceitável.

### D4. Migration como job separado, com orquestração via compose

- Entrypoint da imagem da API com subcomandos: `migrate` (aplica migrations e encerra) e `api` (apenas sobe o servidor — sem migração implícita).
- Os compose files ganham um serviço one-shot `migrate` (mesma imagem, comando `migrate`, `restart: "no"`), e o serviço da API passa a usar `depends_on: migrate: condition: service_completed_successfully`. Assim `docker compose up -d` continua sendo um comando único para o usuário simples, mas a migration roda como **job separado e anterior** ao start da API — atendendo ao card sem sacrificar a experiência "poucos comandos".
- No ADVANCED, o job `migrate` depende de `postgres: service_healthy`.
- O rollout de produção documentado torna as etapas explícitas: backup → `docker compose run --rm migrate` → `docker compose up -d`. Falha na migration aborta o rollout sem derrubar a versão em execução.
- **Alternativa rejeitada**: manter auto-migração no start da API — mais simples, mas impede rollback controlado e é exatamente o comportamento que o card condena.

### D5. Backup/restore como scripts versionados em `scripts/`, com teste automatizado no CI

- `scripts/deploy-backup.ts`, `scripts/deploy-restore.ts` e `scripts/deploy-test-restore.ts` (mesmo estilo dos scripts `smoke.ts`/`regression.ts`), expostos como `bun run deploy:backup`, `deploy:restore` e `test:restore`.
- SIMPLE: backup consistente do SQLite via `VACUUM INTO` + cópia do marcador de instalação/volume; restore para volume/instância limpos.
- ADVANCED: `pg_dump`/`pg_restore` executados via `docker compose exec`/`run` (e backup do volume de uploads); o teste de restore roda no gate ADVANCED do CI.
- O teste de restore no CI (SIMPLE) cria uma instância efêmera via compose, grava dados, executa backup, destrói o volume, restaura e verifica a integridade — é a prova automatizada exigida pelo card.
- **Alternativa rejeitada**: exigir backup externo do operador sem ferramenta — não atende "automatizar backup e teste de restore".

### D6. Novo job `image` no CI

Em `.github/workflows/ci.yml`, um job `image` que: (1) valida os compose files (`docker compose config`), (2) verifica coerência `.bun-version` × Dockerfiles × workflow, (3) builda `Dockerfile` e `Dockerfile.web` (com cache do GHA) e (4) executa `bun run test:restore`. Falha em qualquer etapa reprova o PR.

### D7. Compatibilidade app × schema e rollback documentados no `DEPLOY.md`

Regras publicadas:

- Toda migration é para frente (aditiva quando possível); a aplicação da versão N roda com o schema N e permanece compatível com o schema N+1 após a migração correspondente.
- Rollback padrão: subir a imagem anterior (a migration aplicada não deve quebrá-la). Quando a migration for destrutiva/incompatível, o rollback exige restaurar o backup pré-migração — por isso o backup é etapa obrigatória do rollout.
- Downgrade de schema não é suportado; o `DEPLOY.md` passa a conter uma seção "Rollout, rollback e backup" com a matriz de compatibilidade por release e o link para os scripts.

## Risks / Trade-offs

- [`sharp` (dependência nativa) pode quebrar o build da imagem alpine] → validar no primeiro build do CI; se necessário, instalar libs de sistema no estágio de runtime ou migrar a base para `debian-slim` da mesma tag do Bun.
- [Workspace Bun com `workspace:*` exige install na raiz do monorepo no build da imagem] → estágio de deps já instala o workspace completo; `.dockerignore` mantém o contexto pequeno. Coberto pelo build no CI desde o PR desta change.
- [`depends_on: service_completed_successfully` não é suportado em versões antigas do Docker Compose] → documentar pré-requisito Compose v2 no `DEPLOY.md`; o rollout manual (`run --rm migrate` antes do `up`) continua válido sem essa condição.
- [Remover a auto-migração do start pode quebrar instalações existentes que só dão `docker compose up`] → **BREAKING** comunicado no `DEPLOY.md` e na release note; o serviço one-shot `migrate` nos compose mitiga para quem usa os arquivos versionados.
- [Teste de restore no CI exige Docker no runner] → runner `ubuntu-latest` já fornece; se virar gargalo, mover o teste para job diário, mantendo build + validação em todo PR.
- [Tags exatas de imagem base podem sair de circulação] → risco aceito; bump controlado via `.bun-version` e renovado periodicamente.

## Migration Plan

1. Aterrissar Dockerfiles, entrypoint, compose e scripts — os arquivos versionados passam a ser a fonte; o preparador privado deixa de ser necessário para gerar imagens.
2. Ajustar o fluxo do ambiente existente (labapps): apontar o deploy para os compose versionados, executar `deploy:backup`, `docker compose run --rm migrate` e então `up -d` (primeiro rollout com a nova ordem).
3. Ativar o job `image` no CI e torná-lo required check junto dos existentes.
4. Rollback desta própria change: manter os arquivos antigos do preparador privado à mão na VM até o primeiro rollout bem-sucedido; a aplicação não muda de schema nesta change, então basta voltar a imagem/entrypoint anteriores.

## Open Questions

- Publicar imagens em registry (GHCR) com tag por git tag — follow-up, não bloqueia.
- Multi-arch (`linux/arm64`) para homelabs em ARM — avaliar após o job `image` estabilizar.
