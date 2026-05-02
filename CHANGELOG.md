# Changelog

All notable changes to Azy Board are documented in this file.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
Versioning: Semantic Versioning before the BSL change date (2032-04-26).

---

## [Unreleased]

---

## [0.5.0] - 2026-04-27 — Card Actions & Visual Redesign

### Added

- **Cascade delete**: `DELETE /items/:id` now removes all descendants
  (subtasks, checklists, checklist items, attachments, tags) in a single
  atomic transaction via BFS traversal. Previously blocked on items with
  children.
- **Delete button on cards**: `Trash2` icon appears on card hover; requires
  `window.confirm` before execution. Only rendered for ADMIN and MEMBER roles.
- **`childrenCount` field**: API listing endpoint returns direct child count
  per item without an extra query (computed from already-loaded parent ID set).
- **Children indicator in card footer**: `GitBranch` icon + count shown on
  cards that have subtasks, with native tooltip showing "N subtasks".
- **Blocked card info box**: `ItemModal` displays a blue info box when the
  opened item has subtasks, explaining the Leaf Rule and why the card cannot
  be dragged manually.
- **Lucide React icons on action buttons**: `Trash2`, `GitBranch`, `Info`,
  `Plus`, `Check`, `X`, `Layers`, `BookOpen`, `CheckSquare`, `Bug`, `Pencil`
  — all imported individually (tree-shaken). No new dependency required;
  `lucide-react` was already installed.
- **Filled button styles across the application**: toolbar creation buttons
  (Novo Épico, Nova História, Nova Task, Novo Bug) converted from outline to
  solid fill with distinct colour semantics (amber, violet, blue, red).
  `ItemModal` and `AddCardForm` buttons updated to match.
- **OpenSpec capabilities registered**: `card-delete-action`,
  `blocked-card-info-box`, `card-footer-children-indicator`,
  `button-visual-redesign`.

### Changed

- `CardData` interface gains optional `childrenCount?: number`.
- `Card` interface in `@azy-board/types` gains `childrenCount: number`; `toCard`
  maps it with a `?? 0` default.
- `DELETE /items/:id` response changes from `{ ok: true }` to
  `{ deleted: number }`.

### Security

- Cascade delete applies `tenantId` filter at every BFS level; cross-tenant
  item IDs cannot be injected through the `parentId` chain.

---

## [0.4.0] - 2026-04-27 — Card Checklists

### Added

- Checklist support inside items: named checklists with ordered checklist
  items, checked state, and position management.
- `GET /items/:id/checklists` returns checklists with their items.
- `POST /items/:id/checklists`, `PATCH /checklists/:id`,
  `DELETE /checklists/:id` for checklist lifecycle.
- Checklist item endpoints: `POST`, `PATCH`, `DELETE` under
  `/checklists/:checklistId/items/:itemId`.
- `ChecklistSection` component in `ItemModal` with inline editing, reordering,
  and check/uncheck interactions.
- Checklist progress indicator on Kanban cards: fraction `checked/total` and
  a thin progress bar; turns green when complete.
- WebSocket event `CHECKLIST_UPDATED` broadcasts progress changes in real time.
- MCP tool `update_checklist_item` for agent-driven checklist management.
- Drizzle migration `0001_card-checklists.sql` for `checklists` and
  `checklist_items` tables with cascade foreign keys.

---

## [0.3.0] - 2026-04-26 — Board v2: Filters, Members, and Rich Story Editor

### Added

- **Board filters**: filter panel with module, sprint, assignee, item type,
  and tag selectors; filters apply client-side without additional API calls.
- **Project members panel**: list project members with roles; ADMIN can change
  roles inline.
- **Sprint management**: create, activate, and complete sprints; assign items
  to sprints; filter board by sprint.
- **Story rich editor**: Tiptap-based rich text editor for STORY description,
  persona, goal, benefit, acceptance criteria, and notes fields (`StoryModal`).
- **Tag management UI**: create, rename, and recolour tags via the tag selector
  popover; tags are per-project with tenant isolation.
- **Card type badges**: distinct colour-coded badges (EPIC amber, STORY violet,
  TASK blue, BUG red) in card footer.
- **Story virtual cards**: toggle to render STORY items as non-draggable cards
  in the first board column for cross-team visibility.
- **Column drag-and-drop reordering**: columns within a board can be reordered
  via drag handle.
- **i18n**: full internationalisation support (pt-BR, en, es) via i18next with
  language selector in the header.
- **Dark mode**: Tailwind `darkMode: 'class'`, theme toggle component, CSS
  variables for all colours, persisted per-user preference.

### Changed

- `GET /items` accepts `moduleId`, `sprintId`, `assigneeId`, and `type`
  query parameters.
- Board swimlane layout groups cards by EPIC ancestry path.

---

## [0.2.0] - 2026-04-26 — Board UX Foundations

### Added

- **Epic and Story modals**: create and edit EPICs (with module assignment)
  and STORYs (with EPIC parent) via dedicated modals.
- **Inline card title editing**: double-click on a card title to edit in place.
- **Card detail modal** (`ItemModal`): edit type, status, priority, assignee,
  points, dates, parent story, tags, and description; add subtasks inline.
- **Ancestry breadcrumb on cards**: compact `›`-separated breadcrumb rendered
  inside each card with full path on hover via a portal tooltip.
- **Orphan swimlane**: cards without an EPIC ancestor rendered in a dedicated
  "Sem épico" swimlane.
- **Collapsible swimlanes**: per-EPIC swimlanes collapse to save vertical space;
  state preserved in component memory.
- **Tree view**: hierarchical tree page alongside the Kanban view, toggled from
  the header, showing EPICs → STORYs → TASKs/BUGs.
- **WebSocket realtime sync**: `CARD_MOVED`, `ITEM_CREATED`, `ITEM_UPDATED`,
  `ITEM_DELETED`, `SUBTASK_CREATED`, `TASK_CLAIMED` events propagate to all
  connected clients via Bun native WebSocket.
- **Add card inline form**: per-column quick-add form at the bottom of each
  column with title input and type selector.
- **Vertical card reordering**: drag-and-drop within a column with
  optimistic updates and server-side persistence.
- **User avatar** component with AI badge for agent assignees.

### Changed

- `isLeaf` is now computed server-side from the full item set per request
  rather than client-only.
- `ancestryPath` stored as denormalised JSON for O(1) breadcrumb rendering.

---

## [0.1.0] - 2026-04-25 — Project Ignition

### Added

- Monorepo workspace structure: `apps/api`, `apps/web`, `apps/mcp`,
  `packages/types`.
- **Unified item model**: single `items` table with `type` discriminant
  (`EPIC`, `STORY`, `TASK`, `BUG`) and self-referential `parentId` hierarchy.
- **Multi-tenant architecture**: `tenant_id` on all business entities;
  middleware resolves `tenantId` from JWT (users) or API key (agents); CLI
  provisioning only.
- **JWT authentication**: `HS256` cookie-based sessions (`HttpOnly`, `Secure`,
  `SameSite=Strict`).
- **RBAC**: `ADMIN`, `MEMBER`, `VIEWER` roles enforced server-side on every
  route.
- **Kanban board**: `DndContext` with `@dnd-kit/sortable`; drag-and-drop card
  movement between columns calling `PATCH /items/:id/move`.
- **Columns**: create, rename, delete, reorder with position persistence.
- **Modules**: project sub-groups for organising EPICs.
- **MCP server**: initial `@modelcontextprotocol/sdk` integration; `get_board`
  and `list_items` tools.
- **Shadow Markdown endpoint**: `GET /projects/:id/board.md` returns a
  deterministic Markdown projection of the board state for AI consumption.
- **Drizzle ORM + SQLite**: schema-first migrations; production path targets
  PostgreSQL via adapter swap at `apps/api/src/db/index.ts`.
- **File attachments**: upload and serve project-scoped files with tenant
  membership validation.
- **OpenSpec workflow**: spec-driven change management with `proposal.md`,
  `design.md`, `specs/`, and `tasks.md` per change; archive on completion.
- Core documentation: `LICENSE` (BSL 1.1), `README.md`, `CONTRIBUTING.md`,
  `CHANGELOG.md`, `SECURITY_CHECKLIST.md`.

[Unreleased]: https://github.com/jairo-mello/azy-board/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/jairo-mello/azy-board/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/jairo-mello/azy-board/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/jairo-mello/azy-board/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/jairo-mello/azy-board/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/jairo-mello/azy-board/releases/tag/v0.1.0
