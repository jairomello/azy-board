# Azy Board - The Agent-Native Project Management Hub

[![Powered by Bun](https://img.shields.io/badge/Powered%20by-Bun-000000)](https://bun.sh)
[![MCP Ready](https://img.shields.io/badge/MCP-Ready-2563eb)](https://modelcontextprotocol.io)
[![License: BSL 1.1](https://img.shields.io/badge/License-BSL%201.1-f59e0b)](LICENSE)

Azy Board is an AI-native Kanban hub for mixed Human-AI teams. It is designed
for developers, product operators, and Codex-style coding agents that need a
shared project surface with predictable state, clean APIs, and markdown-native
handoff points.

## Agent-Native Model

### Shadow Markdown

Every board state should have a deterministic Markdown projection. This
"Shadow Markdown" layer gives Codex and other AI agents a stable, text-first
view of columns, cards, owners, labels, status, and task context without
requiring brittle DOM inspection.

The Markdown representation is treated as a compatibility contract. UI changes
must not break agent reads, summaries, diffs, or future command workflows
against the board Markdown endpoint.

### MCP Integration

Azy Board exposes project operations through the Model Context Protocol (MCP).
Agents should be able to inspect board state, retrieve task context, and execute
approved project-management actions through typed MCP tools instead of scraping
the web UI.

## Tech Stack

| Area | Stack |
| --- | --- |
| Frontend | React 19, Vite, shadcn/ui, Tailwind CSS, TanStack Query |
| Backend | Bun, Hono, TypeScript |
| Data | PostgreSQL, Drizzle ORM |
| AI Protocol | MCP SDK, Shadow Markdown |

## Quick Start

```bash
bun install
```

Create the local environment files from the examples used by each app, then run
database setup and migrations:

```bash
bun run setup
bun run db:migrate
```

Start the API and web app:

```bash
bun run dev
```

Run individual services when needed:

```bash
bun run dev:api
bun run dev:web
bun run dev:mcp
```

## Development Checks

```bash
bun run typecheck
bun test
```
