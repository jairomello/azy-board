# Security Checklist

Run this checklist before every push that touches authentication, persistence,
MCP tools, environment configuration, logging, or any agent-facing board state.
Items marked ★ are critical — a failed check must block the push.

---

## 1. Secret Hygiene ★

- [ ] **Zero hardcoded secrets**: scan the diff for API key patterns —
      `sk-...` (OpenAI), `ant-...` (Anthropic), `eyJ...` (raw JWTs),
      database connection strings, and any hex/base64 strings above 32 chars
      that are not test fixtures.
- [ ] **Environment hygiene**: `.env.example` is present and up to date for
      every new environment variable introduced. Required keys at minimum:
      `DATABASE_URL`, `AUTH_SECRET`, `MCP_PORT`, `TENANT_SETUP_KEY`.
      Values in `.env.example` must be obviously dummy (`your-secret-here`,
      `change-me`, etc.).
- [ ] **Secret isolation**: `.env`, `.env.*`, `*.pem`, `*.key`, and any
      runtime credential files are listed in `.gitignore` and absent from the
      staged diff.
- [ ] **MCP token management**: MCP API keys are scoped to a single tenant,
      never committed to the repository, never logged, and never included in
      tool response payloads or error messages.

---

## 2. PII and Data Protection ★

- [ ] **PII masking in Drizzle flows**: user names, email addresses, avatar
      URLs, and account metadata are not emitted in server logs, raw API error
      bodies, MCP responses, Shadow Markdown output, or debug traces.
- [ ] **Schema sensitivity classification**: before adding a column to any
      Drizzle table, classify its data sensitivity (public / internal /
      confidential / PII). Confidential and PII columns must not be included
      in serialisers used by agent-facing endpoints without explicit redaction.
- [ ] **Error body safety**: API error responses return a user-visible message
      only — no stack traces, SQL error text, Drizzle query objects, or
      internal identifiers that reveal schema structure.
- [ ] **Log safety**: structured logs are safe for aggregation in external
      systems (Loki, Datadog, etc.). No PII, no secrets, no raw query results.

---

## 3. Shadow Markdown Integrity ★

- [ ] **Authentication enforced**: the `/board.md` endpoint (and any equivalent
      Shadow Markdown route) rejects unauthenticated requests with `401`.
      API-key validation uses constant-time comparison.
- [ ] **Rate limiting applied**: Shadow Markdown endpoints have request-rate
      limits per API key to prevent board-state exfiltration at volume.
- [ ] **Deterministic output**: given the same board state, the Markdown
      projection must be byte-identical between renders. No timestamps,
      random IDs, or non-deterministic ordering in the output.
- [ ] **No hidden PII**: the Markdown output must not include email addresses,
      avatar URLs, password hashes, or internal user IDs. Assignee references
      use display names only.
- [ ] **Structural stability**: compare the Shadow Markdown diff against the
      previous version. Structural regressions (heading levels, field order,
      list formatting) break agent reads — treat them as breaking changes.

---

## 4. AI Agent Output Controls

- [ ] **MCP tool output**: every MCP tool response is reviewed to confirm it
      does not include secrets, internal stack traces, raw SQL errors, Drizzle
      query objects, or unredacted user metadata.
- [ ] **Tool input validation**: MCP tool inputs are validated against their
      declared schema before execution. Malformed inputs return a typed error,
      not a raw exception.
- [ ] **Agent RBAC parity**: the role restrictions enforced by the REST API
      (`ADMIN`, `MEMBER`, `VIEWER`) apply identically to MCP tool calls. An
      agent's API key cannot grant more than its assigned role permits.
- [ ] **AI data integrity**: any field that agents read or write is validated
      for type, length, and allowed values at the service layer — not only at
      the HTTP boundary. Agents must not be able to corrupt `ancestryPath`,
      `tenantId`, or `isLeaf`-derived state through crafted inputs.
- [ ] **Prompt injection surface**: Shadow Markdown and MCP outputs that are
      fed back into LLM contexts are checked to ensure they do not contain
      attacker-controlled content that could redirect agent behaviour (e.g.,
      malicious card titles containing instruction-like text).

---

## 5. Multi-Tenancy Isolation ★

- [ ] **`tenantId` on every query**: every Drizzle query that touches a
      business entity includes `eq(table.tenantId, ctx.tenantId)` as a filter.
      Queries that omit `tenantId` are a critical IDOR vulnerability.
- [ ] **`// [TENANT]` markers present**: any new code path that resolves or
      applies `tenantId` carries the `// [TENANT] <reason>` architectural
      comment for audit traceability.
- [ ] **Cross-tenant input rejection**: item IDs, column IDs, and other
      resource identifiers supplied by clients are validated against the
      current tenant before use — never trusted as globally unique.

---

## 6. Authentication and Authorisation

- [ ] **JWT properties**: cookies are `HttpOnly`, `Secure`, `SameSite=Strict`.
      Tokens use `HS256` minimum; `exp` claim is present and short-lived.
- [ ] **`requireRole` applied**: every new route handler that modifies state
      calls `requireRole('MEMBER')` or `requireRole('ADMIN')` — read-only
      routes use `requireRole('VIEWER')`.
- [ ] **No privilege escalation path**: `VIEWER`-role requests cannot trigger
      writes, deletes, or agent-claim operations through any code path
      including indirect calls from MCP tools.

---

## 7. Build and Repository Hygiene

- [ ] **`.gitignore` coverage**: the following are absent from the staged diff
      and present in `.gitignore`: `node_modules/`, `.bun/`, `dist/`, `build/`,
      `.vite/`, `coverage/`, `*.db`, `*.db-shm`, `*.db-wal`, `.env`, `.env.*`.
- [ ] **Dependency review**: new packages are evaluated for necessity,
      maintenance status, and transitive access to filesystem, network, or
      process environment APIs. No GPL or AGPL dependencies.
- [ ] **Migration safety**: new Drizzle migrations are either fully reversible
      or include a documented, approved data-retention decision for destructive
      changes. The `// [DB-SWAP]` marker is present at every SQLite-specific
      adapter touch point.
- [ ] **No binary blobs**: images, fonts, and other static assets have a
      documented source and are intentionally included — not accidentally staged.
