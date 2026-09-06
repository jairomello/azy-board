# Azy Board — The Agent-Native Project Management Hub

[![Powered by Bun](https://img.shields.io/badge/Powered%20by-Bun-000000?logo=bun&logoColor=white)](https://bun.sh)
[![MCP Ready](https://img.shields.io/badge/MCP-Ready-2563eb?logo=anthropic&logoColor=white)](https://modelcontextprotocol.io)
[![License: BSL 1.1](https://img.shields.io/badge/License-BSL%201.1-f59e0b)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Azy Board is a Kanban project management hub purpose-built for mixed Human-AI
teams. It treats AI agents as first-class collaborators — not integrations bolted
on top of a human-centric tool — and provides dedicated protocols for both
reading and mutating board state.

### Sprint lifecycle

Sprints use the lifecycle `PROPOSED -> OPEN -> CLOSED`. Name, start date and end
date are required; only one sprint per project can be open at a time. Cards
already linked to a closed sprint remain available for historical filtering, but
new links are rejected by the API. The Board filter lists all sprint statuses,
while card creation lists only proposed and open sprints.

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
| `list_projects` / `get_project` | Descobre projetos e suas configurações |
| `get_board` / `get_tree` | Lê o board estruturado ou sua árvore |
| `get_shadow_markdown` | Retorna a projeção Shadow Markdown |
| `create_project` / `update_project` | Cria e configura projetos |
| `create_task` / `update_item` | Cria e atualiza items e subtasks |

O Board permite filtrar em memória por tag (tags selecionadas usam OR), versão,
prioridade, status e autor. Dimensões diferentes são combinadas com AND. O
vínculo de versão é opcional e fica em `items.version_id`; pode ser informado
na criação rápida de TASK/BUG ou no `create_task` do MCP.
| `claim_task` / `release_task` | Atribui ou libera trabalho |
| `move_task` / `complete_task` | Move e conclui cards |
| `archive_item` / `unarchive_item` / `delete_item` | Gerencia ciclo de vida de items |
| `create_module`, sprints, tags e versões | Administra planejamento do projeto |
| `list_members` / `list_squads` | Consulta colaboração e equipe |
| `list_checklists`, logs e tags | Registra evidências de execução |

As ferramentas legadas `list_tasks` e `list_modules` continuam disponíveis para
compatibilidade com agentes já configurados.

MCP tools are auditable, scoped to a tenant, and enforce the same RBAC rules
as the REST API. Agents cannot escalate beyond the role granted to their API
key.

### Official Agent Skill

The official, client-agnostic agent skill is maintained in
[`skills/azyboard/`](skills/azyboard/). Load `SKILL.md` into Claude Code,
OpenCode, Codex or another compatible client to receive the Azy Board MCP
playbooks and semantic slash commands. Client-specific installation guidance
is available in [`skills/azyboard/commands/README.md`](skills/azyboard/commands/README.md).

Validate the catalog, references and commands locally with:

```bash
bun run test:agent-skill
```

### Azy Agent (chat humano)

O Azy Agent fica desligado por padrão. Um usuário `ROOT` deve configurar, no
tenant, um modelo OpenAI e uma API key válida no painel de administração, testar
a conexão e ativar o toggle. A chave fica somente no backend, cifrada, e nunca
é enviada ao browser, ao chat ou aos logs. O modelo recomendado para começar é
`gpt-5.6-luna`. O Azy Agent suporta somente API keys oficiais para chamadas à
API de modelos. Login ChatGPT, Codex access tokens e outros tokens de produto não
fazem parte do contrato de credenciais do assistente.

Limites iniciais econômicos: 10 mensagens por minuto por usuário, 1 run ativa
por usuário, 3 por tenant, 50 KB por mensagem/payload, 4 passos, 8 tool calls,
45 segundos e orçamento diário de 100.000 micros por usuário (1.000.000 por
tenant). O Root pode acompanhar consumo, runs ativas e ajustar esses parâmetros
na seção de governança do tenant, sempre dentro de faixas de segurança. Runs
interrompidas por limite ficam registradas com código operacional; mutações exigem
prévia e aprovação humana. Cards, texto colado e CSV são dados não confiáveis e
não podem substituir as regras do sistema.

O chat oferece o histórico do usuário, perguntas de esclarecimento, aprovação,
cancelamento, importação CSV com prévia e stream SSE reconectável. Comandos
semânticos equivalentes à skill: `/azyboard-status`, `/azyboard-plan`,
`/azyboard-start`, `/azyboard-update`, `/azyboard-complete` e
`/azyboard-review`. Consulte a [página do Azy Agent na wiki](docs/azyboard-wiki/09%20-%20Agentes%20e%20Integracoes/Azy%20Agent%20humano.md)
e `docs/AI_AGENT_DATA_POLICY.md` antes de habilitar o recurso.

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

**Nested Board lanes**: the default Kanban layout renders
`Epic → Story → Cards` with independently collapsible Epic and Story lanes.
Users can switch Stories back to card mode, hide empty Story lanes, and create
Tasks or Bugs directly inside a Story context.

**Board modes**: each project can use `HIERARCHICAL` (the default), with module,
Epic and Story lanes, or `SIMPLE`, with one fixed Story and a single Kanban flow.
Admins can convert projects between modes; conversion preserves cards and their
related data, while converting to simple removes the module/Epic structure.

**Permissions**: users have one global group, ordered as `TEAM_MEMBER`,
`MANAGER`, `ADMIN` and `ROOT`. MCP agents inherit the Owner's group, tenant,
project membership and local role. API Key scopes can only restrict access and
never grant privileges beyond the Owner.

**Ancestry Path**: each item stores a denormalised `ancestryPath` JSON column
— `[{ id, title, type }, …]` — enabling O(1) breadcrumb rendering without
recursive joins.

**Tree View progress**: the hierarchical view displays progress bars for leaf
TASK/BUG items and accumulated progress for Stories, Epics and other grouping
nodes, using only non-archived descendants in the visible filtered result.

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
the required values before running `setup`. The setup requires an explicit
administrator password through its fourth argument or `ADMIN_PASSWORD`.
For MCP usage, copy
`apps/mcp/.env.example` to `apps/mcp/.env` and set an API key generated in the
web app. Never commit `.env` files.

---

## Development Checks

```bash
bun run typecheck   # tsc --noEmit across all workspaces
bun test            # Bun test runner
bun run test:integration  # API integration tests in an isolated SQLite database
bun run test:mcp          # MCP tools without external services or credentials
bun run test:mcp-catalog  # MCP catalog and authorization policies
bun run test:agent-skill   # skill, commands and references
bun run test:smoke        # HTTP smoke test; use SMOKE_URL for a published app
```

---

## License

Licensed under the [Business Source License 1.1](LICENSE). Free for
non-commercial use, internal business use, and self-hosted deployments.
Commercial exploitation or managed-service resale requires a separate agreement.
Converts to Apache 2.0 on **2032-04-26**.
