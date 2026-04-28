# Contributing to Azy Board

High-quality contributions must preserve the agent-native contract of the
project. Azy Board is not only a Kanban UI; it is a structured coordination
surface for humans, Codex, and MCP-compatible agents.

## Engineering Standards

- Use TypeScript for all application code.
- Keep code clear, small, and explicit. Prefer readable domain behavior over
  clever abstractions.
- Follow Clean Code practices: descriptive names, small functions, explicit
  boundaries, and minimal hidden state.
- Use Domain-Driven Design patterns in the backend. Keep entities, repositories,
  services, and transport handlers separated by responsibility.
- Prefer existing local conventions before introducing new libraries or
  architectural patterns.

## Spec-Driven Development

- Use OpenSpec for changes that affect product behavior, domain rules, public
  APIs, MCP tools, data models, or Shadow Markdown contracts.
- Keep specs close to the intended behavior: define the user-visible outcome,
  domain constraints, acceptance criteria, and compatibility impact before
  implementation.
- Update the relevant OpenSpec files when implementation details change the
  agreed behavior. Code and specs should not drift.
- Small refactors that do not change behavior may skip a new spec, but the pull
  request should state that no product contract changed.

## AI Compatibility

- Any UI change that affects boards, columns, cards, labels, users, or status
  must preserve Shadow Markdown compatibility.
- The board Markdown endpoint, including `/board.md` when implemented, is a
  public contract for AI agents. Do not change its structure without a migration
  note and compatibility plan.
- MCP tools must expose typed, minimal, auditable operations. Avoid tool outputs
  that leak secrets, raw database errors, or unnecessary PII.
- Agent-facing text should be deterministic enough for Codex to diff, summarize,
  and act on reliably.

## Testing

- Add unit tests for domain logic and pure utilities.
- Add integration tests for API handlers, Drizzle persistence flows, MCP tools,
  and Shadow Markdown generation.
- Use `bun test` for the test suite.
- Include regression coverage when fixing bugs.

## Pull Request Checklist

- TypeScript passes without errors.
- Relevant unit and integration tests pass with `bun test`.
- OpenSpec changes are included for behavior, API, MCP, data model, or Shadow
  Markdown contract changes.
- Database migrations are included for schema changes.
- Shadow Markdown output remains compatible or includes a documented migration.
- Security checklist items are reviewed before push.
