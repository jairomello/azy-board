## Context

A API (Bun + Hono, `apps/api/src/index.ts`) monta middlewares globais em `app.use('*', ...)` (CORS → `errorResponseMiddleware` → `clientIpMiddleware`) e trata erros em `app.onError` com `console.error`. Não há request ID, logs estruturados, security headers (apenas `X-Content-Type-Options` pontual em attachments/avatar), health endpoints, métricas, tracing ou error tracking — cenário registrado no card **Item 30** e em `docs/ANALISE-SISTEMA.md:767-794`.

Pontos do código que hoje sustentam a observabilidade e serão aproveitados:

- `apps/api/src/middleware/errorResponse.ts` — envelope único de erro, `safeDetails` (redação) e padrão de middleware pós-`next()`; `apps/api/src/middleware/errorResponse.test.ts` é o padrão de teste de middleware.
- `apps/web/src/lib/renderError.ts:51` — `reportRenderError` já é o ponto único de extensão declarado para um provedor de observabilidade, com identificador de referência por ocorrência (`frontend-error-boundary`).
- `apps/api/src/db/installProfile.ts` — padrão de parsing validado de configuração (`InstallProfileConfigurationError`, valores nunca em mensagens de erro).
- `apps/api/src/services/storageCleanup.ts` (fila in-process com retry/backoff), `db/sqlite/itemUnitOfWork.ts`/`atomicTransaction.ts` (transações/locks), `services/assistantHarness.ts:123-133` (steps/tokens/custo de runs do agente) e `coordination/ports.ts:23` (readiness do Redis no perfil ADVANCED) — fontes naturais das métricas.
- Web em produção é servido por nginx fora do repositório (`DEPLOY.md`); o pipeline Hono não vê upgrades WebSocket (`index.ts:104-140`).

Restrições: PT-BR; apenas licenças MIT/Apache-2.0/BSD/ISC/Public Domain; perfil SIMPLE (padrão) deve continuar sem serviços externos; multi-tenant com `tenant_id` em toda query; redação de segredos já exigida por `unified-error-contract`.

## Goals / Non-Goals

**Goals:**

- Correlacionar qualquer resposta, log e erro pelo mesmo request ID (`X-Request-Id`), do frontend ao backend.
- Logs JSON estruturados de requisição (método, rota, status, duração, tenant anonimizado) e de exceções, sem segredos.
- Headers de segurança na API e paridade documentada para o web servido.
- `/health/live` e `/health/ready` públicos, usáveis por smoke test e healthchecks de deploy.
- Telemetria OTel (tracing + métricas de latência/erros/SQLite locks/filas/agente) exportada por OTLP apenas quando configurada.
- Error tracking opcional no frontend e no backend, com redação e correlação.
- Tudo opcional e sem mudança de comportamento quando as variáveis de telemetria não existem.

**Non-Goals:**

- Não alterar o envelope de erro (`unified-error-contract`); correlação é por header e logs.
- Não instrumentar WebSocket handshake (upgrade acontece fora do pipeline Hono) nem logs do MCP (stdio não aceita JSON no stdout).
- Não definir retenção do log de auditoria de login (encaminhado em `login-security`).
- Não adotar provedor de métricas proprietário nem exigir Sentry/OTel para operar.
- Não versionar Dockerfiles/nginx completos; apenas documentar e prover o trecho de headers.

## Decisions

### 1. Pipeline de middlewares e um único middleware de observabilidade

Criar `requestObservabilityMiddleware` registrado em `app.use('*', ...)` antes das rotas (ordem final: security headers → observabilidade → CORS → errorResponse → clientIp), seguindo o padrão pós-`next()` do `errorResponseMiddleware` para capturar status e duração reais. O middleware: gera/propaga o request ID, expõe `requestId` no contexto Hono (`c.set`) e emite um log JSON ao final da requisição.

*Alternativas:* logging em cada handler (esparso, duplicado, fácil de esquecer) — rejeitado; framework de APM auto-instrumentado sem middleware explícito (New Relic etc., licenças/dependências pesadas) — rejeitado.

### 2. Request ID: `X-Request-Id` gerado ou propagado

Aceitar `X-Request-Id` de entrada apenas se corresponder a `[A-Za-z0-9._-]{1,64}`; caso contrário, gerar `crypto.randomUUID()`. Sempre devolver o header na resposta (inclusive erros) e usá-lo em logs e no escopo do error tracking. O header `traceparent` do OTel é independente e não substitui o request ID legível.

*Alternativas:* reusar o `correlationId` de domínio de eventos de item (`services/analytics.ts`) — rejeitado por ter semântica de dedupe de mutações, não de requisição HTTP.

### 3. Logger JSON próprio, sem dependência

Novo módulo `apps/api/src/services/logger.ts` emitindo um objeto JSON por linha em stdout (com `ts`, `level`, `msg`, `requestId`, `method`, `route`, `status`, `durationMs`, `tenant`), nível configurável por `LOG_LEVEL` (padrão `info`; formato `pretty` em dev, `json` em produção). Substituir os `console.*` do runtime da API (`index.ts` `onError`, `projects.ts:176`, `storageCleanup.ts`); scripts CLI continuam com `console`. Requisições de health ficam em nível `debug` para não inflar o volume.

*Alternativas:* pino (MIT) — sólido, mas traz transporte/abstração que o volume atual não justifica; manter `console.error` com prefixos — não resolve estrutura nem correlação. A interface do logger deve ser pequena (um objeto de log por evento) para permitir troca futura sem reescrever chamadas.

### 4. Tenant anonimizado e redação

O campo `tenant` do log é um hash truncado (SHA-256, 12 hex) do `tenant_id`, estável para correlação local e não reversível para o UUID; o mesmo helper é usado no error tracking. IDs crus de usuário/tenant, cookies, tokens, API keys, corpos de requisição e query strings nunca entram em logs nem em payloads de terceiros. A redação reutiliza/amplia o escopo de `safeDetails` do `errorResponse.ts` e é coberta por teste.

### 5. Security headers via `hono/secure-headers` + paridade no web

Usar o middleware nativo do Hono (MIT, já na dependência) com CSP de `default-src 'self'`, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` e `HSTS` somente quando a requisição for HTTPS (respeitando `TRUST_PROXY`); nunca emitir HSTS em dev/HTTP simples para não travar instalações locais. `style-src` começa com `'self' 'unsafe-inline'` (Tiptap/shadcn usam estilos inline) e será verificado na implementação com os testes E2E existentes. Para o web: `server.headers` no Vite (paridade de dev) e trecho pronto de `add_header`/CSP no `DEPLOY.md` (nginx fora do repo), sem meta tag CSP (`frame-ancestors` não vale em meta).

*Alternativas:* headers manuais por rota — rejeitado (esparso); exigir CSP estrita desde o primeiro deploy — arriscado quebrar o editor; CSP-Report-Only como modo intermediário fica disponível como flag se o E2E acusar regressão.

### 6. Health endpoints públicos e sem dados sensíveis

`GET /health/live` (fora de `/api`, sem auth): 200 enquanto o processo atende. `GET /health/ready`: 200 quando banco (`SELECT 1`), storage (acesso ao diretório configurado) e — apenas no perfil ADVANCED — `coordination/ports.ts` `check()` respondem; caso contrário 503 com corpo JSON listando apenas o nome das dependências falhas (sem versões, caminhos ou IDs). Usados pelo `scripts/smoke.ts` e referenciados nos healthchecks de `docker-compose.advanced.yml`.

### 7. OpenTelemetry sob demanda, no-op por padrão

Dependências Apache-2.0 (`@opentelemetry/api`, `sdk-node`, exporters OTLP de traces e metrics) carregadas por import dinâmico somente quando `OTEL_EXPORTER_OTLP_ENDPOINT` estiver definido; sem a variável, a aplicação usa a API no-op e o custo é desprezível. Métricas: duração/contagem HTTP por rota e status, erros, retries/locks SQLite (instrumentar o laço de retry de `itemUnitOfWork`/`atomicTransaction` e o `busy` do adapter), fila de limpeza de storage (pendentes, idade, processadas, falhas) e runs do agente (steps, tokens, custo micros, rejeições de quota), aproveitando `assistantHarness`. Tracing: um span por requisição HTTP com o request ID como atributo; spans de banco ficam em sampling baixo.

*Alternativas:* endpoint Prometheus text exposition em código próprio — mais leve, mas o card pede OpenTelemetry e OTLP é neutro de provedor (o exportador Prometheus pode vir depois sem mudar a instrumentação); SDK sempre carregado — aumenta o consumo do perfil SIMPLE sem ganho quando desligado.

### 8. Error tracking opcional e agnóstico de provedor

Interface `ErrorTracker` (init/captureException/setContext/flush) com implementação Sentry (MIT: `@sentry/node` no backend, `@sentry/react` no frontend) como referência — GlitchTip ou self-hosted funcionam pelo mesmo DSN. Habilitado apenas com `SENTRY_DSN` (API) e `AZYBOARD_SENTRY_DSN` (web, via `loadEnv` do Vite); sem DSN, não inicializa e não envia nada. Backend captura exceções do `onError`/`errorResponseMiddleware`; frontend estende `reportRenderError` (mantendo a referência como tag) e captura `unhandledrejection`/`error` global opcional. `beforeSend` aplica a redação do item 4 (sem cookies, headers de autorização, corpos ou IDs crus) e anexa o request ID quando houver.

*Alternativas:* OpenTelemetry error events como único canal — não oferece agrupamento/deduplicação de erros; console-only — é exatamente o estado atual reprovado pelo card.

### 9. Configuração validada e fracionada por fase

Novo módulo de configuração de observabilidade seguindo `installProfile.ts`: `LOG_LEVEL`, `LOG_FORMAT`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `SENTRY_DSN` (e espelho no web). Valores nunca aparecem em mensagens de erro nem em logs. A entrega fraciona em fases independentes (logs+request ID → headers+health → OTel → error tracking), cada uma reversível por configuração, sem migrations de banco.

## Risks / Trade-offs

- [CSP quebra o web (estilos inline do Tiptap, avatares/data: URLs)] → validar com a bateria E2E (`test:regression --with-e2e`) antes de travar as diretivas; manter flag de CSP report-only como saída de emergência e revisar `style-src` na implementação.
- [HSTS em instalação local HTTP deixa o navegador exigir HTTPS] → emitir HSTS somente em HTTPS detectado (com `TRUST_PROXY`); nunca em dev.
- [Volume/custo de logs em instalações grandes] → health em nível `debug`, `LOG_LEVEL` configurável, sem query strings/corpos; sem sampling de erro (erros sempre logados).
- [SDKs OTel/Sentry aumentam o bundle/instalação do perfil SIMPLE] → import dinâmico e inicialização opcional; consumo zero quando as variáveis não existem; dependências licenciadas MIT/Apache-2.0.
- [Vazamento de PII/segredos para terceiros (Sentry)] → redação em `beforeSend` com teste de contrato próprio, hash de tenant, e ausência de corpo/query string no payload.
- [WebSocket e rota estática do nginx ficam fora da observabilidade da API] → documentado como limite; logs de aplicação cobrem o que passa pelo Hono; extensão futura pode instrumentar o handshake no `Bun.serve`.
- [Health público vaza informação da infra] → corpo mínimo (nome da dependência x ok/falha), sem versões, caminhos, hostnames ou IDs.
- [Métricas de SQLite locks imprecisas] → medir no ponto real de conflito (retry de transação e adapter), com teste unitário do contador, em vez de inferir por tempo de resposta.

## Migration Plan

1. **Fase 1 — correlação e logs:** logger + request ID + substituição dos `console.*` do runtime. Entrega valor imediato, sem dependências novas; rollback = reverter o commit.
2. **Fase 2 — headers e health:** security headers na API, health endpoints, `DEPLOY.md`/compose e smoke. Validar com E2E antes de encerrar; rollback = remover o middleware (comportamento volta ao atual).
3. **Fase 3 — telemetria OTel:** instrumentação e métricas, export só com `OTEL_EXPORTER_OTLP_ENDPOINT`. Sem a variável, nada muda em runtime.
4. **Fase 4 — error tracking:** interface + Sentry FE/BE com redação. Sem DSN, nada é enviado.

Sem migrations de banco nem mudança de contrato de API (o header `X-Request-Id` é aditivo). Cada fase roda `bun run check` e `bun run test:smoke`; ao final, `openspec validate add-headers-observability` e fechamento do card no board.

## Open Questions

- Incluir `requestId` no envelope de erro (`unified-error-contract`) numa change futura? Ficou fora para não quebrar consumidores atuais; o header já atende à correlação.
- Ativar captura global de `window.onerror`/`unhandledrejection` por padrão quando houver DSN, ou apenas sob flag explícita? Decidir na Fase 4 com base no ruído observado.
- Vale versionar um `Dockerfile`/conf de nginx completos no repo (hoje fora dele)? Por ora apenas o trecho de headers no `DEPLOY.md`; a decisão sobre versionar fica para a change de deploy.
