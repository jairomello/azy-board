## 1. Configuração e fundação de observabilidade

- [ ] 1.1 Criar módulo de configuração de observabilidade seguindo o padrão de `apps/api/src/db/installProfile.ts` (`LOG_LEVEL`, `LOG_FORMAT`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `SENTRY_DSN`), com validação de formato e valores nunca exibidos em mensagens de erro ou logs
- [ ] 1.2 Criar helper de identificador anonimizado de tenant (hash SHA-256 truncado) com comentário `// [TENANT]` explicando que o `tenant_id` não pode ser logado em texto
- [ ] 1.3 Criar `apps/api/src/services/logger.ts` (JSON por linha, níveis debug/info/warn/error, formato pretty em dev e json em produção) com função de redação de cookies, tokens, chaves, corpos e query strings
- [ ] 1.4 Adicionar testes do logger: formato JSON, níveis filtrados por `LOG_LEVEL`, redação de dados sensíveis e hash de tenant estável

## 2. Request ID e log estruturado de requisição

- [ ] 2.1 Criar `requestObservabilityMiddleware`: gerar `X-Request-Id` (ou propagar o de entrada quando válido em `[A-Za-z0-9._-]{1,64}`), expor `requestId` no contexto Hono e devolver o header em toda resposta, inclusive de erro
- [ ] 2.2 Emitir, ao final da requisição (padrão pós-`next()` do `errorResponseMiddleware`), o log JSON com request ID, método, rota sem query string, status, duração e tenant anonimizado quando autenticado; health endpoints em nível `debug`
- [ ] 2.3 Registrar os middlewares em `apps/api/src/index.ts` na ordem definida no design (security headers → observabilidade → CORS → errorResponse → clientIp)
- [ ] 2.4 Substituir os `console.error`/`console.log` do runtime da API (`index.ts` `onError`, `routes/projects.ts:176`, `services/storageCleanup.ts`) pelo logger estruturado, incluindo exceção com request ID e stack apenas em log
- [ ] 2.5 Adicionar testes de contrato do middleware no padrão de `errorResponse.test.ts`: geração, propagação, substituição de valor inválido, header presente em erro e ausência de query string/credenciais no log

## 3. Health endpoints

- [ ] 3.1 Criar `GET /health/live` (público, fora de `/api`) respondendo 200 com corpo mínimo sem versões, caminhos ou IDs
- [ ] 3.2 Criar `GET /health/ready` verificando banco (consulta trivial via porta de persistência, com `// [DB-SWAP]` onde o driver importar) e acesso ao diretório de storage; no perfil ADVANCED incluir `check()` de `coordination/ports.ts`; 200 quando tudo responde e 503 listando apenas os nomes das dependências falhas
- [ ] 3.3 Garantir que o perfil SIMPLE responde readiness sem depender de coordenação externa
- [ ] 3.4 Estender `scripts/smoke.ts` para validar `GET /health/live` e atualizar `DEPLOY.md`/`docker-compose.advanced.yml` apontando `GET /health/ready` nos healthchecks
- [ ] 3.5 Adicionar testes dos health endpoints (200 com dependências OK, 503 com banco/storage indisponível, ADVANCED x SIMPLE)

## 4. Security headers

- [ ] 4.1 Aplicar `hono/secure-headers` na API com CSP (`default-src 'self'`, `frame-ancestors 'none'`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` e `Referrer-Policy`, presente em respostas de sucesso, erro e arquivos
- [ ] 4.2 Emitir `Strict-Transport-Security` apenas em HTTPS de produção, respeitando `TRUST_PROXY`, e nunca em desenvolvimento/HTTP simples
- [ ] 4.3 Validar a CSP contra o web real (editor Tiptap, avatares/data-URIs, estilos inline) com a bateria E2E, ajustando `style-src`/`img-src` e mantendo flag de report-only como saída de emergência documentada
- [ ] 4.4 Configurar `server.headers` no Vite para paridade de headers em desenvolvimento
- [ ] 4.5 Documentar no `DEPLOY.md` o trecho pronto de headers (CSP e demais) para o nginx que serve o web em produção
- [ ] 4.6 Adicionar testes dos headers da API em respostas de sucesso, erro e download de arquivos

## 5. Telemetria OpenTelemetry

- [ ] 5.1 Adicionar dependências Apache-2.0 (`@opentelemetry/api`, `sdk-node` e exporters OTLP de traces/metrics) com bootstrap por import dinâmico apenas quando `OTEL_EXPORTER_OTLP_ENDPOINT` estiver configurado; sem a variável, manter instrumentação no-op
- [ ] 5.2 Registrar métricas HTTP de duração/contagem por método, rota e status, além do contador de erros
- [ ] 5.3 Instrumentar conflitos de banco nos pontos reais (laço de retry de `itemUnitOfWork`/`atomicTransaction` e adapter, com `// [DB-SWAP]` para o adaptador PostgreSQL): contagem de retries por lock/busy e duração de transações críticas
- [ ] 5.4 Expor métricas da fila de `storageCleanup`: pendentes, idade do mais antigo, processadas e falhas
- [ ] 5.5 Registrar métricas de runs do agente a partir de `assistantHarness` (steps, tokens de entrada/saída, custo micros) e contagem de rejeições por quota
- [ ] 5.6 Gerar span por requisição HTTP com o request ID como atributo para correlação com logs
- [ ] 5.7 Adicionar testes: sem `OTEL_EXPORTER_OTLP_ENDPOINT` nada é exportado e o fluxo funciona; com exporter mock, contadores/histogramas são incrementados nos pontos esperados

## 6. Error tracking

- [ ] 6.1 Criar interface `ErrorTracker` (init/captureException/setContext/flush) com implementação no-op usada quando não há DSN
- [ ] 6.2 Integrar o backend com Sentry (`@sentry/node`, MIT) inicializado apenas com `SENTRY_DSN`, capturando exceções do `onError`/`errorResponseMiddleware` e erros 5xx com o request ID no escopo
- [ ] 6.3 Implementar o `beforeSend` de redação (sem cookies, autorização, corpos, query strings ou IDs crus; tenant em hash) reutilizando o escopo de `safeDetails`, com teste de contrato da redação
- [ ] 6.4 Estender `apps/web/src/lib/renderError.ts` para encaminhar erros do boundary ao provedor (`AZYBOARD_SENTRY_DSN` via `loadEnv` do Vite), preservando a referência da ocorrência como dado de correlação sem alterar a tela de erro
- [ ] 6.5 Adicionar captura opcional de `window.onerror`/`unhandledrejection` no frontend, habilitada por configuração explícita
- [ ] 6.6 Adicionar testes: sem DSN não há envio nem dependência de rede; com DSN mock, o evento traz request ID (backend) e referência (frontend) redigidos

## 7. Verificação e encerramento

- [ ] 7.1 Rodar `bun run check` (typecheck + lint + persistência + testes + build) e corrigir divergências
- [ ] 7.2 Rodar `bun run test:smoke` (incluindo o novo `/health/live`) e `bun run check:bundle` para o impacto do frontend
- [ ] 7.3 Rodar a bateria E2E (`bun run test:regression --with-e2e`) confirmando que a CSP não quebra login, board, modal de item e editor
- [ ] 7.4 Rodar `bun run check:i18n` se houver textos novos de interface e `openspec validate add-headers-observability`
- [ ] 7.5 Registrar o acompanhamento com `Board ref: 22f0c796-3ea3-452d-9a1d-0ffcac43450d` (Item 30) e fechar o card com `complete_task`, confirmando no board que entrou em coluna `DONE`
