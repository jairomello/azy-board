# Azy Board — The Agent-Native Project Management Hub

[![Powered by Bun](https://img.shields.io/badge/Powered%20by-Bun-000000?logo=bun&logoColor=white)](https://bun.sh)
[![MCP Ready](https://img.shields.io/badge/MCP-Ready-2563eb?logo=anthropic&logoColor=white)](https://modelcontextprotocol.io)
[![License: BSL 1.1](https://img.shields.io/badge/License-BSL%201.1-f59e0b)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Azy Board is a Kanban project management hub purpose-built for mixed Human-AI
teams. It treats AI agents as first-class collaborators — not integrations bolted
on top of a human-centric tool — and provides dedicated protocols for both
reading and mutating board state.

---

## Agent-Native Model

Two primary contracts define how AI agents interact with Azy Board:

### Shadow Markdown

The Shadow Markdown layer exposes a deterministic, text-first projection of the
entire board — columns, cards, owners, labels, status, priorities, ancestry
paths, and checklist progress — as a single Markdown document served through a
dedicated read endpoint.

This projection is a **compatibility contract**. Any UI change that modifies
board state must keep the Markdown output structure stable. Agents use it for:

- Summarising sprint or backlog state without UI access
- Diffing board state across time or between branches
- Providing grounded, structured context before issuing MCP commands
- Autonomous reporting, triage, and prioritisation flows

The endpoint is authenticated via API key, rate-limited, and produces output
safe for direct LLM consumption — no PII fields, no internal identifiers, no
raw stack traces.

### MCP Integration

Azy Board exposes project management operations through the
[Model Context Protocol (MCP)](https://modelcontextprotocol.io). Agents
registered with an API key can call typed MCP tools to inspect and act on
board state programmatically:

| Tool | Description |
|------|-------------|
| `get_board` | Returns full board state as structured data |
| `list_items` | Queries items by type, status, assignee, or sprint |
| `create_item` | Creates a task, bug, story, or epic |
| `update_item` | Patches fields on an existing item |
| `move_card` | Moves a leaf card to a target column |
| `get_shadow_markdown` | Returns the Shadow Markdown projection |

MCP tools are auditable, scoped to a tenant, and enforce the same RBAC rules
as the REST API. Agents cannot escalate beyond the role granted to their API
key.

---

## Tech Stack

| Area | Technology |
|------|-----------|
| **Frontend** | React 18, Vite 5, TypeScript 5, Tailwind CSS 3, Radix UI |
| **UI Primitives** | Lucide React, dnd-kit, Tiptap (rich text), i18next |
| **Backend** | Bun, Hono 4, TypeScript 5 |
| **Data** | Drizzle ORM — SQLite (dev) → PostgreSQL (prod) |
| **AI Protocol** | MCP SDK (`@modelcontextprotocol/sdk`), Shadow Markdown |
| **Shared Types** | `@azy-board/types` (monorepo workspace package) |
| **Realtime** | WebSocket (Bun native) |

---

## Architecture Overview

```
apps/
  api/          Hono REST + WebSocket server (Bun runtime)
  web/          React 18 SPA (Vite)
  mcp/          MCP server — AI agent protocol layer
packages/
  types/        Shared TypeScript types (ItemType, CardData, WsEvent…)
openspec/       Spec-driven change history and capability registry
```

**Multi-tenancy**: every table carries `tenant_id`. All queries go through a
`withTenant(tenantId)` helper. Tenants are provisioned via CLI only — no
self-signup surface.

**Leaf Rule**: only items without children (`isLeaf: true`) are movable Kanban
cards. Parent items aggregate status and points from descendants. Cascade
deletion removes all descendants, checklists, and attachments atomically.

**Ancestry Path**: each item stores a denormalised `ancestryPath` JSON column
— `[{ id, title, type }, …]` — enabling O(1) breadcrumb rendering without
recursive joins.

---

## Quick Start

```bash
# 1. Install all workspace dependencies
bun install

# 2. Bootstrap the first tenant and admin user
bun run setup

# 3. Apply database migrations
bun run db:migrate

# 4. Start the API and web app
bun run dev
```

Run services individually when needed:

```bash
bun run dev:api    # Hono API on :3000
bun run dev:web    # Vite dev server on :5173
bun run dev:mcp    # MCP stdio server for configured agent clients
```

**Environment**: copy `apps/api/.env.example` to `apps/api/.env` and fill in
the required values before running `setup`. For MCP usage, copy
`apps/mcp/.env.example` to `apps/mcp/.env` and set an API key generated in the
web app. Never commit `.env` files.

---

## Development Checks

```bash
bun run typecheck   # tsc --noEmit across all workspaces
bun test            # Bun test runner
```

---

## License

Licensed under the [Business Source License 1.1](LICENSE). Free for
non-commercial use, internal business use, and self-hosted deployments.
Commercial exploitation or managed-service resale requires a separate agreement.
Converts to Apache 2.0 on **2032-04-26**.
