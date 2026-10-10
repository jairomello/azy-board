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

O deploy usa 2 containers, buildados a partir dos arquivos **versionados neste
repositório** (não há Dockerfile gerado fora do repo):

- `azyboard-web` (`Dockerfile.web`, nginx) servindo o build estático do Vite e,
  em publicação standalone, repassando `/api` e `/ws` para a API.
- `azyboard-api` (`Dockerfile`, Bun) rodando Hono + Drizzle.

### Arquivos de deploy versionados

| Arquivo | Papel |
| --- | --- |
| `Dockerfile` | imagem da API (multi-stage, `ARG BUN_VERSION` espelhando `.bun-version`) |
| `Dockerfile.web` | imagem Web (build do Vite + nginx), build arg `AZYBOARD_BASE_PATH` |
| `docker/entrypoint-api.sh` | subcomandos `api` (padrão) e `migrate` (job de rollout) |
| `docker/nginx-web.conf.template` | nginx do web (estático, SPA fallback, proxy de `/api` e `/ws`) |
| `docker-compose.simple.yml` | perfil SIMPLE (SQLite) |
| `docker-compose.advanced.yml` | perfil ADVANCED (PostgreSQL + Valkey) |

A coerência entre `.bun-version`, os Dockerfiles e o workflow do CI é garantida
por `bun run check:deploy-versions` (executado no job `image` do CI).

Configurar o proxy reverso para encaminhar a API, a aplicação e o WebSocket
(abaixo, os hostnames `azyboard` e `web` são os serviços dos compose files
versionados; ajuste conforme a rede do seu ambiente):

1. `/app/api/` → `azyboard:3000`, com rewrite
   `^/app/api/(.*)$ /api/$1 break`.
2. `/app/` → `web:80`, com rewrite
   `^/app/(.*)$ /$1 break` + sub_filter injetando
   `window.__BASE_PATH__="/app/"`.

3. `/app/ws` → `azyboard:3000`, com rewrite para `/ws` e suporte a
   upgrade WebSocket HTTP/1.1.

## Pré-requisitos

- **Docker** e **Docker Compose v2** (`docker compose` — o serviço `migrate`
  usa `depends_on.condition: service_completed_successfully`, não suportado
  pelo docker-compose v1).
- **Bun** na versão de `.bun-version` para builds/verificações locais.

## Variáveis de ambiente (produção)

- `NODE_ENV=production`.
- `PORT=3000` (api).
- `DATABASE_URL=/data/azyboard.db` (SQLite via Drizzle).
- `MIGRATIONS_DIR=/app/migrations` — definido pela imagem da API, que embute
  `apps/api/src/db/migrations` em `/app/migrations` (revisadas junto com o
  código em cada commit).
- `UPLOADS_DIR=/app/uploads` — volume de uploads (definido pela imagem).
- `FRONTEND_URL=https://example.com/app/` (origem permitido pelo CORS).
- `JWT_SECRET`: segredo para assinar o cookie de sessão.

Os valores de domínio, host, caminhos privados e credenciais devem ser
configurados somente na infraestrutura do ambiente, nunca neste repositório.
O código da aplicação permanece portável entre raiz (`/`), subpaths e outros
domínios.

## Login integrado (opcional, card T45)

O método de autenticação humana é decidido **na instalação** (permanente; sem
migração em runtime). Variáveis:

- `AZYBOARD_AUTH_PROVIDER`: `LOCAL` (padrão), `MICROSOFT` ou `GOOGLE`.
- `AZYBOARD_AUTH_REDIRECT_URL`: URL pública do callback (ex.: mesma origem, sem
  sessão) — obrigatória nos modos integrados.
- `AZYBOARD_MICROSOFT_CLIENT_ID`, `AZYBOARD_MICROSOFT_CLIENT_SECRET`,
  `AZYBOARD_MICROSOFT_TENANT_ID`: credenciais do EntraID (modo `MICROSOFT`).
- `AZYBOARD_GOOGLE_CLIENT_ID`, `AZYBOARD_GOOGLE_CLIENT_SECRET`: credenciais do
  Google (modo `GOOGLE`).

Comportamento observável: no modo `LOCAL` a tela de login mostra e-mail e
senha; nos modos integrados mostra apenas o botão do provedor ("Entrar com
Microsoft"/"Entrar com Google"), o login por senha é recusado (403
`PASSWORD_LOGIN_DISABLED`) e a identidade é vinculada por e-mail canônico a um
usuário **já existente** — nunca há auto-provisionamento nem vínculo a outro
tenant. A inicialização falha de forma explícita quando um provedor integrado
não tem as credenciais exigidas.

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
- **Docker:** veja `docker-compose.simple.yml`. Suba com
  `docker compose -f docker-compose.simple.yml up -d` — web em
  `http://localhost:8080` e API em `:3000` (portas configuráveis via
  `AZYBOARD_WEB_PORT`/`AZYBOARD_API_PORT`).

### ADVANCED

- **Banco:** PostgreSQL 16+.
- **Coordenação:** Valkey (BSD) ou Redis-compatível.
- **Capacidade:** suporta mais usuários; instância única de API.
- **Configuração:** veja `apps/api/.env.example.advanced`.
- **Docker:** veja `docker-compose.advanced.yml`. Suba com
  `docker compose -f docker-compose.advanced.yml up -d` (mesmas portas do
  SIMPLE; PostgreSQL/Valkey publicados nas portas padrão, configuráveis via
  `AZYBOARD_PG_PORT`/`AZYBOARD_VALKEY_PORT`).

#### Instalação e migrations do ADVANCED (CLI)

O boot da API **não** aplica migrations nem cria tenant. A ordem suportada em
uma instalação nova é:

```bash
# 1. Aplica o schema PostgreSQL (runner idempotente, com histórico em schema_migrations)
AZYBOARD_INSTALL_PROFILE=ADVANCED DATABASE_URL=postgresql://... bun run db:migrate:pg

# 2. Cria tenant e administrador (sem endpoint HTTP de tenant)
AZYBOARD_INSTALL_PROFILE=ADVANCED DATABASE_URL=postgresql://... \
  REDIS_URL=redis://... AZYBOARD_INSTANCE_DIR=/var/lib/azyboard \
  bun run --cwd apps/api src/scripts/setup.ts "Minha Empresa" minha-empresa admin@exemplo.com "SenhaForte" "Admin"

# 3. Sobe a API (valida marcadores, compõe persistência/coordenação e só então aceita tráfego)
```

O runner `db/postgres/migrate.ts` aplica **todos** os arquivos `.sql` do
diretório de migrations em ordem, não uma lista fixa, e pode ser reexecutado sem
alterar dados válidos. O setup usa o store de marcadores do próprio dialect e
recusa marcador divergente, revisão incompatível ou troca de perfil.

#### Limites operacionais do ADVANCED

- **Instância única de API:** múltiplas instâncias/HA não são suportadas até
  que a fila/worker do agente (Item 4), a reconciliação do board (Item 20) e
  os controles distribuídos restantes sejam implementados.
- **Capacidade orientativa:** aproximadamente 20+ pessoas com uma instância.
  Não é uma restrição de conta nem uma promessa de desempenho.
- **Valkey é a referência comunitária** Redis-compatível (licença BSD). O
  cliente `ioredis` (MIT) funciona com qualquer servidor Redis-compatível.
- **Lifecycle por processo (T36/T37):** o boot compõe persistência e coordenação
  por perfil e expõe um `close()` que encerra apenas os recursos daquele
  processo (pool/arquivo + coordenação + timers/listeners). Em ADVANCED a API
  **não** consome mais a fila de runs: o consumo ocorre no processo dedicado
  `agent-worker` (ver **Worker do agente (T37)**). Journal/outbox (**T38**) e
  transporte distribuído (**T39**) continuam dependentes e não são pré-requisitos
  para o boot de instância única.

#### Worker do agente (T37)

O consumo da fila de runs do agente é escolhido por perfil e validado no boot
(configuração cruzada é recusada):

- **SIMPLE → `IN_PROCESS` (padrão):** a API inicia o worker no próprio processo.
- **ADVANCED → `SEPARATE` (padrão):** a API apenas enfileira/consulta/aprova/
  cancela; o consumo fica no processo dedicado.
- **`AZYBOARD_AGENT_WORKER_MODE`** pode forçar `IN_PROCESS`, `SEPARATE` ou
  `DISABLED`; valores incompatíveis com o perfil falham o boot.

Comandos do entrypoint da imagem (`docker/entrypoint-api.sh`):

```bash
api      # sobe o servidor HTTP (sem aplicar migrations)
migrate  # aplica migrations do perfil e encerra
worker   # sobe o consumidor dedicado de runs (ADVANCED/SEPARATE), sem HTTP
```

No compose ADVANCED o serviço `agent-worker` usa a **mesma imagem/schema/segredos**
da API, sem porta publicada, com `restart` próprio e `depends_on` de
`migrate`/`valkey`. `SIGTERM` para de buscar runs, drena a execução corrente e
aborta com prazo; o release é sempre fenced pela geração de lease.

**Diagnóstico e alertas:**

- **Fila sem consumidor:** profundidade (`agent.queue.depth`, agregação real) > 0
  sem claims (`agent.queue.claim_latency_ms` sem amostras) — verifique se o
  serviço `agent-worker` está de pé e no modo `SEPARATE` em ADVANCED.
- **Lease churn:** `agent.worker.lease_expirations` e `agent.worker.aborts`
  crescendo indicam workers morrendo/pausando antes do fim da execução.
- **Fence rejeitado:** `agent.worker.fence_rejected` > 0 indica que uma geração
  antiga tentou finalizar/escrever após recuperação — esperado durante takeover,
  anômalo se persistente.
- **Efeitos externos incertos:** abort **não** desfaz chamada já aceita por
  fornecedor; não há promessa de exactly-once. Resultado ambíguo deve ser
  reconciliado pelo destino antes de qualquer retry.
- Logs correlacionam `runId`/`workerId`/`generation` sem credenciais.

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
`contracts`, `smoke`, `e2e`, `advanced (PostgreSQL + Valkey)` e
`image (deploy reproduzível)`. O job `smoke` verifica o fluxo autenticado SIMPLE;
`advanced` sobe PostgreSQL 16 e Valkey 8, aplica migrations pelo runner do perfil,
executa setup CLI, sobe API/Web e roda o mesmo contrato de smoke nesse perfil.
`image` constrói as imagens e ensaia restore integral em SIMPLE e ADVANCED. O
workflow [`weekly-restore.yml`](.github/workflows/weekly-restore.yml) repete o
ensaio semanalmente e publica manifestos/evidências vinculados ao SHA.

Não publique uma versão com gate reprovado. A lista é política local de checks;
branch protection/rulesets e bloqueio efetivo de merge são configuração externa
e permanecem `NAO_COMPROVADO`. Para reproduzir os jobs e consultar estados,
consulte [`docs/ci.md`](docs/ci.md) e
[`docs/release-evidence.md`](docs/release-evidence.md).

## Rollout, rollback e backup

> **BREAKING:** a migration **não** é mais aplicada implicitamente no start da
> API em produção. A aplicação das migrations acontece apenas pelo job
> separado `migrate` (serviço one-shot do compose / subcomando do entrypoint).
> Instalações que dependiam de auto-migração no start devem executar o job
> antes do primeiro `up` desta versão.

### Ordem de rollout

1. **Backup** (obrigatório em instalação com dados):
   `bun run deploy:backup` (ou `--compose-file docker-compose.advanced.yml` no
   ADVANCED). Gera `backups/backup-<data>/` com banco, uploads, marcador de
   instalação e `manifest.json`.
2. **Migration como job separado**: `docker compose -f <compose> run --rm migrate`
   — falhou, aborte o rollout; a versão em execução permanece intacta.
3. **Start**: `docker compose -f <compose> up -d` (nova imagem; o serviço
   `migrate` roda de novo como no-op idempotente antes da API).

Com os compose files versionados, o `docker compose up -d` já executa o job
`migrate` antes de subir a API (`depends_on: condition:
service_completed_successfully`); os passos explícitos acima são o rollout
controlado de produção.

### Cutover do worker do agente (T37)

A separação do worker é **breaking operacional** no ADVANCED: a API deixa de
consumir a fila. Não conviva com uma versão antiga (worker in-process, sem
fence) e uma nova ao mesmo tempo.

1. **Parar consumidores antigos**: escale/parar a API anterior (ou o worker
   in-process) para que não haja dois consumidores sem fence. Drene o lease
   vigente (`SIGTERM` respeita drain/abort com prazo).
2. **Migrations**: `docker compose run --rm migrate` (adiciona
   `lease_generation`/`recovery_attempts`; aditivo, sem perda de dados).
3. **Subir API não consumidora + worker fenced**: `docker compose up -d`, que
   sobe `azyboard` (API, modo `SEPARATE` por padrão) e `agent-worker` (processo
   dedicado). Valide `/health/ready` e a fila (`agent.queue.depth` caindo).
4. **Rollback**: pare o `agent-worker` novo e volte a imagem anterior. Como o
   fence é do banco, uma versão antiga **sem fence** só é aceitável com restauração
   verificada do mesmo perfil; nunca rolling misto entre gerações incompatíveis.
   Em SIMPLE o modo `IN_PROCESS` é mantido; nenhum serviço novo é necessário.

### Backup e restore

- `bun run deploy:backup [--out <dir>] [--perfil SIMPLE|ADVANCED]` — SIMPLE:
  snapshot consistente do SQLite (`VACUUM INTO`) + marcador + uploads; ADVANCED:
  `pg_dump` + uploads.
- `bun run deploy:restore <dir-do-backup>` — restaura em **instância limpa**
  (banco, marcador e uploads são substituídos; não é merge de dados).
- `bun run test:restore` — teste automatizado de backup/restore em instância
  efêmera nos dois perfis (executado no CI, job `image`, e semanalmente).
- Os manifestos registram perfil, image ID/revision, hashes de migrations,
  fixture verificada, perda observada e tempos de backup/recuperação. O restore
  integral substitui banco/marcador/uploads em volume novo e requer downtime;
  tempos medidos não são compromisso de RTO/RPO.

### Compatibilidade entre versão da aplicação e schema

- As migrations são apenas para frente. A aplicação da versão N roda com o
  schema N e continua compatível com o schema N+1 correspondente.
- **Downgrade de schema não é suportado.**
- Releases com migrations destrutivas/incompatíveis são sinalizadas no
  CHANGELOG; para essas, o rollback exige restaurar o backup feito antes da
  migration.

### Rollback

1. **Schema compatível** (caso padrão): suba a imagem anterior
   (`docker compose up -d` com a tag/commit anterior). Nenhuma restauração é
   necessária.
2. **Migration incompatível/estragada**: restaure o backup pré-migração
   (`bun run deploy:restore <dir>`) e então suba a imagem anterior.
3. Sem backup válido, não há rollback de dados — por isso o backup é etapa
   obrigatória do rollout.

### Definição curta de pronto para deploy

Deploy está pronto quando os gates aplicáveis passaram no SHA candidato, smoke e
restore cobrem o perfil escolhido, e os manifestos/logs permitem reproduzir a
conclusão sem alegar limites que não foram medidos. Evidência local sobre working
tree alterada não substitui artefato do workflow vinculado ao SHA.

## Idempotência e operações (T38)

- **Chave de idempotência**: `POST` de item e `POST /batch` aceitam `Idempotency-Key`
  (ou `idempotencyKey` no corpo); `update_items` usa o `agentRunId` como chave. A
  mesma chave com **payload divergente** retorna **409 `IDEMPOTENCY_CONFLICT`**.
- **Mesma transação**: a chave, o corpo da resposta, a auditoria, o analytics e o
  evento de domínio são gravados **no mesmo commit** da mutação. Um crash após o
  commit e antes da resposta é recuperável: o retry devolve o resultado original
  (status/body/IDs) sem repetir efeitos.
- **`X-Operation-Id`**: comandos com chave devolvem esse header aditivo. Consulte
  `GET /api/operations/:operationId` para obter `status` (`PENDING`/`COMMITTED`),
  `httpStatus`, `body` e `publication.pending` (evento já confirmado, mas ainda
  não despachado). A consulta **revalida o acesso atual** ao projeto/tenant.
- **Retenção**: resultados públicos ficam disponíveis por **≥ 24 h** para replay.
  A outbox só remove eventos **confirmados e publicados** com mais de 24 h; o
  contador de sequência e as pendências nunca são apagados. Commits legados sem
  chave **não** têm garantia retroativa.
- **Eventos duráveis**: cada mutação confirmada entra numa outbox com sequência
  monotônica por projeto; um dispatcher publica no WebSocket após o commit
  (entrega at-least-once, dedupe por `eventId`/sequência). O replay do WS por
  cursor usa a outbox (retenção/limite de 1.000 exigem refetch).

### Cutover da idempotência/outbox (T38)

As migrations T38 (`0039/0040` no SQLite; `0010/0011` no PostgreSQL) são
**aditivas**. Cutover coordenado sem perder pendências:

1. **Parar writers** durante a janela de migration (nenhuma mutação concorrente
   enquanto a outbox/contador são criados).
2. **Migrations** pelo job separado (`migrate` / `db:migrate:pg`). Não alteram
   dados existentes.
3. **Subir a API nova**: o dispatcher da outbox passa a publicar eventos
   confirmados no WebSocket. Commits **legados sem chave não têm garantia
   retroativa** — não recalcule nem reenvie por conta própria.
4. **Rollback**: a poda só remove eventos `PUBLISHED` com mais de 24 h; o
   contador de sequência e as pendências **nunca** são apagados. Ao reverter a
   imagem, mantenha as tabelas de journal/outbox para preservar pendências e
   evitar republicação cega.

## Sincronização em tempo real entre instâncias (T39)

- **Pub/Sub é aceleração, não durabilidade.** Eventos **já confirmados** na outbox
  T38 são publicados pelo `CoordinationPort` (Valkey) em canais versionados
  `azyboard:v2:evt:<tenant>:<projeto>`; cada API assina as salas ativas e entrega
  localmente. O Pub/Sub **não** é fila nem replay: a verdade durável continua no
  SQL/outbox. Não há promessa de HA geral só por usar Pub/Sub.
- **SIMPLE sem serviço externo.** Sem `REDIS_URL`, a entrega é local/in-process
  pelo mesmo fluxo pós-commit; nenhum Valkey é exigido.
- **Retenção e limites de replay.** Replay pelo cursor usa a outbox com retenção
  de **≥ 24 h** e no máximo **1.000 eventos** por reconciliação. Cursor inválido,
  à frente, legado sem continuidade, fora da retenção ou acima do limite gera
  `RESYNC_REQUIRED` (motivo tipado) e o cliente refaz as consultas ativas.
- **Última mensagem perdida.** Cada API compara o watermark durável das salas
  ativas a cada heartbeat e ao reconectar o subscriber; diferença aciona
  replay/refetch mesmo **sem novo evento**. Se a assinatura do barramento falha,
  a readiness degrada (probe `realtime`) e a sala é recomposta no ciclo seguinte,
  sem descartar a outbox.
- **Cliente honesto.** `connecting → syncing → synced | offline`; `synced` só
  após replay contíguo até o watermark ou refetch/barreira concluído. Falha de
  refetch mantém `syncing` e retenta; duplicatas são ignoradas; lacunas voltam a
  `syncing`. A barreira de refetch compara a revisão antes/depois das consultas.
- **Métricas de lag.** `realtime.lag_seconds` (idade do confirmado mais antigo não
  entregue), `realtime.gap.detected`, `realtime.delivery.dedup`,
  `realtime.resync{reason}` e `realtime.refetch.confirmed` — **sem** tenant como
  label. Alerte sobre `lag_seconds` crescente e `resync` por `retention`/`overflow`.
- **Protocolo e cursor legado.** O handshake negocia `protocol` (versão atual 2).
  Cliente sem `protocol` que ainda envia cursor é tratado como **legado** e recebe
  `RESYNC_REQUIRED` (refetch), nunca conversão do cursor local em sequência global.
- **Recuperação/refetch (runbook).** 1) Confirme `GET /health/ready` (inclui
  `coordination` e `realtime` em ADVANCED). 2) Verifique a outbox pendente e o
  dispatcher nos logs. 3) Se o lag persistir, force refetch do cliente recarregando
  a página (cursor legado) — o SQL/outbox permanece a fonte. 4) Não recrie outbox
  nem reinicie contadores manualmente.

### Cutover de protocolo e rollback (T39)

Aditivo; **não** migra perfis nem apaga contador/outbox:

1. **Ordem de rollout**: publique contratos/web e servidor de forma coordenada.
   O web novo envia `protocol` e reconcilia por replay/barreira; clientes antigos
   com cursor recebem `RESYNC` e refazem as consultas (cutover de cursor legado).
2. **Subir o subscriber/dispatcher** em uma API primeiro, validar `ready` e
   lag antes de escalar para duas instâncias. Libere a topologia multi-API com
   agente apenas com T36/T37/T38/T39 verificados.
3. **Rollback para uma API**: pare as réplicas extras e mantenha uma. O
   dispatcher drena a outbox por versão compatível, o watermark/contador
   **não reinicia** e as pendências são preservadas. Force refetch dos clientes
   (recarregar) em vez de converter cursores.

## Health endpoints

A API expõe dois endpoints públicos de health (sem autenticação):

- `GET /health/live` — retorna 200 enquanto o processo está ativo. Use para
  liveness probes.
- `GET /health/ready` — retorna 200 quando banco, storage e (no ADVANCED)
  coordenação estão disponíveis; 503 com `{"status":"error","dependencies":[...]}`
  caso contrário. As probes são consultas limitadas (sem replay/backfill por
  requisição). Coordenação ausente ou Valkey indisponível em ADVANCED reprova
  readiness mesmo com o banco saudável; o liveness permanece 200. Use para
  readiness probes.

### Healthchecks de deploy

Os compose files versionados já incluem healthcheck da API apontando para
`/health/ready` (exatamente o bloco abaixo, usado em
`docker-compose.advanced.yml`):

```yaml
healthcheck:
  test: ["CMD", "wget", "-qO-", "http://localhost:3000/health/ready"]
  interval: 30s
  timeout: 5s
  retries: 3
```

### Headers de segurança (nginx)

Para o web servido por nginx em produção, adicione os seguintes headers:

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss:; frame-ancestors 'none';" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "no-referrer" always;
```
