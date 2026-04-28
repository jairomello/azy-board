# Security Checklist

Use this checklist before every push that touches authentication, persistence,
MCP tools, environment configuration, logs, or agent-facing board state.

## Pre-Push Security Guardrails

- [ ] Zero hardcoded secrets: scan for OpenAI tokens (`sk-...`), Anthropic
  tokens (`ant-...`), database credentials, JWT secrets, and provider API keys.
- [ ] Environment hygiene: `.env.example` documents required keys with dummy
  values, including `DATABASE_URL`, `MCP_PORT`, and `AUTH_SECRET`.
- [ ] Secret isolation: `.env`, `.env.*`, local key files, and private runtime
  configs are ignored by Git.
- [ ] PII masking in Drizzle flows: user names, emails, and account metadata are
  not exposed in server logs, raw API errors, MCP responses, or debug traces.
- [ ] Schema review: new Drizzle columns are classified by sensitivity before
  they are added to API serializers or agent-readable projections.
- [ ] Shadow Markdown integrity: the `/board.md` endpoint has API-key
  validation, rate limiting, deterministic output, and no hidden PII fields.
- [ ] MCP token management: MCP tokens are scoped, rotated, stored outside the
  repository, and never emitted through tool responses or logs.
- [ ] Agent output controls: MCP tools and Markdown projections do not include
  secrets, internal stack traces, raw SQL errors, or unredacted user metadata.
- [ ] Build artifacts: `.gitignore` excludes `.bun`, Vite caches, dependency
  folders, generated builds, and coverage outputs.
- [ ] Dependency review: new packages are necessary, maintained, and do not add
  avoidable access to filesystem, network, or process environment APIs.
- [ ] Database safety: migrations are reversible or documented, and destructive
  changes require an explicit data-retention decision.
- [ ] Production logging: logs are structured, minimal, and safe for aggregation
  in external systems.
