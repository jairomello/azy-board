# Contributing to Azy Board

Azy Board is not a conventional Kanban UI. It is a structured coordination
surface for humans, Codex-style agents, and MCP-compatible AI systems. Every
contribution must preserve the integrity of that contract.

---

## Engineering Standards

### TypeScript

All application code — frontend, backend, MCP server, and shared packages —
must be written in TypeScript with `strict` mode enabled. Implicit `any` is
not permitted. New public interfaces must be placed in `packages/types/` when
shared across workspaces.

### Clean Code

- Functions do one thing. If you need a comment to explain what a function
  does, rename it instead.
- Names are intention-revealing: `deleteItemCascade`, not `remove` or `del`.
- Avoid deep nesting. Early returns and guard clauses are preferred.
- No magic numbers or inline string literals for domain values — derive them
  from shared type enums.
- Comments explain **why**, never **what**. Exception: `// [TENANT]` and
  `// [DB-SWAP]` architectural markers are required at tenant-isolation and
  database-adapter boundaries.

### Domain-Driven Design (Backend)

The API layer follows a layered responsibility model:

| Layer | Responsibility |
|-------|---------------|
| **Route handler** | Parse request, validate shape, call service, return response |
| **Service / query** | Domain logic, multi-step orchestration, side-effects |
| **Repository / Drizzle** | Persistence — always scoped with `tenantId` |
| **Schema** | Single source of truth for column types and FK relationships |

Never put domain logic in route handlers. Never call Drizzle directly from
handlers — route through a service or query function. Every query that touches
a business entity **must** filter by `tenantId`.

### Leaf Rule Invariant

Do not weaken the Leaf Rule. Only items with `isLeaf: true` are movable
Kanban cards. Parent items aggregate status and points from their descendants.
Cascade operations (delete, archive, status rollup) must traverse descendants
correctly.

---

## Spec-Driven Development

Use [OpenSpec](openspec/) for any change that affects:

- Product-visible behaviour or domain rules
- Public REST endpoints or response shapes
- MCP tool signatures, inputs, or outputs
- Shadow Markdown structure or field availability
- Drizzle schema (new tables, columns, or FK relationships)
- Shared types in `packages/types/`

Workflow:

```
/opsx:propose   →   /opsx:apply   →   /opsx:archive
```

Small refactors that do not change any observable contract may skip a formal
spec, but the pull request description must state explicitly that no product
contract changed and why.

---

## AI Compatibility

### Shadow Markdown Contract

The board Markdown endpoint (`/board.md`) is a **public API for AI agents**.
Its structure — headings, card format, field order, status labels, and
ancestry breadcrumbs — must remain stable across UI changes.

Before merging a UI change that touches board state:

1. Render the Shadow Markdown output before and after your change.
2. Confirm the diff contains only expected content changes, not structural
   regressions.
3. If the structure must change, document the migration in the pull request
   and update the spec.

### MCP Tools

- Tool inputs and outputs must be typed, minimal, and auditable.
- Tool responses must never include secrets, raw database errors, internal
  stack traces, or unredacted PII.
- Adding or renaming a tool is a breaking change for registered agents —
  version the change and communicate it clearly.
- Every new MCP tool must have a corresponding spec entry and an integration
  test.

---

## Testing

Use `bun test` for the full suite. Test placement:

| Test type | Location |
|-----------|----------|
| Unit tests (pure logic, utilities) | `src/__tests__/unit/` |
| Integration tests (API handlers, Drizzle flows) | `src/__tests__/integration/` |
| MCP tool tests | `apps/mcp/src/__tests__/` |
| Shadow Markdown output tests | `apps/api/src/__tests__/shadow/` |

Requirements:

- New domain logic requires unit tests.
- New or modified API endpoints require integration tests that hit a real
  in-memory SQLite database — no mocking the persistence layer.
- New MCP tools require integration tests covering at least the happy path and
  a permission-denied scenario.
- Bug fixes require a regression test that reproduces the failure before the fix.

---

## Commit Conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add cascade delete for items with subtasks
fix: prevent ghost items after WebSocket reconnect
docs: expand Shadow Markdown compatibility rules
chore: update Drizzle to 0.38
```

Breaking changes use `feat!:` or `fix!:` and must include a `BREAKING CHANGE:`
footer explaining the impact on agents and API consumers.

---

## Pull Request Checklist

- [ ] `bun run typecheck` passes with zero errors.
- [ ] `bun test` passes with no regressions.
- [ ] OpenSpec change included for any modified product contract.
- [ ] Database migration included for any schema change.
- [ ] Shadow Markdown output remains structurally compatible, or a documented
      migration plan is included.
- [ ] MCP tool signatures are unchanged, or the change is versioned.
- [ ] Security checklist reviewed — see `SECURITY_CHECKLIST.md`.
- [ ] No hardcoded secrets, PII in logs, or raw errors in agent-facing output.
