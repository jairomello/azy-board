## Why

A API e o web não emitem headers de segurança (CSP, X-Frame-Options/frame-ancestors, HSTS), não possuem request ID, logs estruturados, health endpoints, métricas, tracing nem error tracking: o diagnóstico de produção depende de `console.error` solto, sem correlação entre requisição, tenant e erro. O card **Item 30** registra exatamente essas lacunas e o risco operacional de operar (inclusive com agentes e filas) sem observabilidade.

## What Changes

- Middleware de **request/correlation ID** na API: gera ou propaga `X-Request-Id`, devolve o header em toda resposta e usa o ID em todos os registros daquela requisição.
- **Logs JSON estruturados** no servidor (timestamp, nível, requestId, método, rota, status, duração, tenant anonimizado), substituindo os `console.error`/`console.log` do runtime da API; segredos e dados pessoais continuam redigidos.
- **Headers de segurança** na API (CSP com `frame-ancestors`, `X-Frame-Options`, `HSTS` em produção/HTTPS, `X-Content-Type-Options`, `Referrer-Policy`) e paridade no web servido (modelo de configuração do servidor estático + dev server).
- **Health endpoints** públicos: `/health/live` (processo vivo, sem dependências) e `/health/ready` (banco, storage e, no perfil ADVANCED, coordenação).
- **Telemetria operacional** com OpenTelemetry (Apache-2.0): tracing de requisições e métricas de latência/erros por rota, SQLite locks, fila de limpeza de storage e runs do agente (steps, tokens, custo, quota), exportadas por OTLP apenas quando configurado — o perfil SIMPLE continua sem serviços externos.
- **Error tracking** no frontend e no backend (Sentry MIT ou equivalente), opcional via DSN em ambiente, com redação antes do envio e correlação pelo identificador de referência do boundary e pelo request ID.

## Capabilities

### New Capabilities

- `security-headers`: headers HTTP de segurança emitidos pela API e pelo web (CSP, frame-ancestors/X-Frame-Options, HSTS, nosniff, Referrer-Policy), incluindo regras por ambiente (desenvolvimento x produção).
- `request-observability`: request/correlation ID, logs JSON estruturados de requisição com duração/rota/status/tenant anonimizado e redação de dados sensíveis.
- `health-endpoints`: rotas públicas de liveness e readiness com semântica de status e verificação de dependências.
- `operational-telemetry`: instrumentação OpenTelemetry de tracing e métricas operacionais (HTTP, SQLite locks, filas, agente) com export OTLP opcional.
- `error-tracking`: captura e envio de erros do frontend e do backend a um provedor de error tracking, com redação, sampling e correlação.

### Modified Capabilities

- Nenhuma capability existente tem requisito alterado: o envelope de erro permanece regido por `unified-error-contract` (a correlação usa o header `X-Request-Id` e os logs, sem mudar o payload) e o `frontend-error-boundary` continua usando seu ponto de extensão de observabilidade.

## Impact

- **API:** `apps/api/src/index.ts` (ordem de middlewares e `onError`), novos `apps/api/src/middleware/` (request ID, logs, security headers), rotas de health, `services/storageCleanup.ts` e caminhos de runtime que hoje usam `console.*`; `db/installProfile.ts` como padrão de parsing de novas variáveis (`OTEL_EXPORTER_OTLP_ENDPOINT`, `SENTRY_DSN`, `LOG_LEVEL`).
- **Web:** `apps/web/src/lib/renderError.ts` (ponto de extensão já preparado), captura opcional de erros não tratados e configuração de CSP no dev server.
- **Deploy:** documentação/modelo de headers do servidor estático (nginx) em `DEPLOY.md` e `docker-compose.advanced.yml`, apontando os health endpoints nos healthchecks.
- **Dependências novas (licenças permitidas):** SDKs OpenTelemetry (Apache-2.0) carregados sob demanda e Sentry (MIT) opcional; nenhum serviço externo obrigatório.
- **Testes:** contratos de middleware (padrão de `errorResponse.test.ts`), health endpoints, redação de logs e smoke/healthcheck.
- **Rastreabilidade:** Board ref: `22f0c796-3ea3-452d-9a1d-0ffcac43450d` (Item 30).
- **Fora de escopo:** retenção do log de auditoria de login (encaminhado em `login-security`), logs do MCP (stdio não pode receber JSON no stdout), instrumentação de WebSocket handshake (upgrade acontece fora do pipeline Hono) e migração de dados/métricas de negócio do dashboard.
