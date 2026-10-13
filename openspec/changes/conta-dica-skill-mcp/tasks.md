# Tasks

## 1. Dica visível no painel de orientação

- [x] 1.1 Adicionar as chaves `mcpGuideSkillHint` (com `{{command}}`) e `mcpGuideSkillCommand` no namespace `settings` em pt-BR, en e es; verificar `bun run check:i18n`.
- [x] 1.2 Renderizar a dica como parágrafo curto no fim de `McpConnectionGuide.tsx`, com ícone discreto e texto secundário; verificar com teste de componente que a dica aparece, cita a skill `azyboard` e o comando `/azyboard-setup-mcp`, e não menciona valor de chave.

## 2. Verificação

- [x] 2.1 `bun run typecheck`, `bun run test:web`, `bun run check:i18n` e `bun run check:frontend-tests` verdes; conferir em `/account` que a dica aparece junto da orientação do MCP.

## Workflow follow-up

- Arquivar a change após a revisão do projeto.
- Se um card do Azy Board for criado para este trabalho, registrar `Board ref: <itemId>` nos artefatos e encerrar o card em uma coluna com `baseStatus` DONE.
