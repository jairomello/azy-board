## Context

O monorepo tem um único package compartilhado (`packages/types`, 389 linhas) consumido por três apps via `paths` do tsconfig e alias do Vite — sem `node_modules` link. O MCP expõe 59 ferramentas via `apps/mcp/src/registry.ts` (576 linhas), que importa `tools.ts` (dispatch HTTP), `policies.ts` (28 linhas), `validation.ts` (146 linhas) e `limits.ts` (14 linhas). A API importa esses módulos por caminho relativo (`../../../mcp/src/...`) sem declarar dependência. Há import circular `registry ↔ validation` e drift de `AssistantProvider` ('OPENAI' vs 'OPENAI' | 'OPENOPENROUTER').

## Goals / Non-Goals

**Goals:**
- Extrair tool registry, policies, validation e limits para `packages/tool-registry`, consumido por nome de package.
- Separar `@azy-board/types` em packages por domínio (domain, api-contracts, realtime-contracts, assistant-contracts, ui-contracts).
- Corrigir drift de `AssistantProvider` e eliminar tipos duplicados.
- Manter barrel de compatibilidade `@azy-board/types` re-exportando tudo durante a migração.
- Preservar todos os testes existentes (registry-contract, optional-fields, etc.).

**Non-Goals:**
- Não alterar comportamento de runtime (ferramentas, schemas, policies continuam idênticas).
- Não migrar para build/publicação de packages (continuam como fonte TS).
- Não separar `tools.ts` (dispatch HTTP) — permanece em `apps/mcp` como implementação.
- Não alterar contratos de API REST ou WebSocket.

## Decisions

### 1. Um package `tool-registry` vs packages separados para registry/policies/validation

Criar `packages/tool-registry` com submódulos (`registry.ts`, `policies.ts`, `validation.ts`, `limits.ts`) e barrel único. O import circular `registry ↔ validation` é resolvido movendo `requiredFieldsFor` e `isRegisteredTool` para um módulo interno compartilhado (`fields.ts`) que ambos importam.

*Alternativa:* packages separados (`tool-registry`, `tool-policies`, `tool-validation`) — rejeitado: granularidade desnecessária para módulos coesos de 28–146 linhas.

### 2. Extração de `@azy-board/types` em 5 packages vs 2

Criar `packages/domain` (enums de entidade), `packages/api-contracts` (erros, auth, transporte), `packages/realtime-contracts` (WebSocket), `packages/assistant-contracts` (assistente + limits), `packages/ui-contracts` (preferências, presentation, board adapter). Barrel `@azy-board/types` re-exporta tudo.

*Alternativa:* manter `@azy-board/types` como barrel + mover só o que causa drift — rejeitado: não resolve o problema estrutural de domínio misturado.

### 3. `executeSharedTool` permanece em `apps/mcp`

O dispatch HTTP (`executeSharedTool`, ~50 chamadas a `tool*`) fica em `apps/mcp/src/tools.ts` e recebe o registry via import do package. O package `tool-registry` exporta definições, schemas, validação e policies — sem dependência de transporte.

*Alternativa:* mover `tools.ts` para o package com injeção de `ApiCall` — rejeitado: aumenta o escopo sem benefício imediato; pode ser feito depois.

### 4. Resolução de packages via workspaces (symlink) vs `paths` do tsconfig

Padronizar em workspaces do Bun (symlink em `node_modules/@azy-board/*`). Os `paths` do tsconfig e o alias do Vite são mantidos como fallback para builds que não passam por `bun install`, mas a fonte de verdade é o `package.json` de cada app.

*Alternativa:* manter apenas `paths` — rejeitado: impede Docker builds parciais e não reflete dependências reais.

### 5. Migração incremental com barrel de compatibilidade

`packages/types/src/index.ts` passa a re-exportar de `./domain`, `./api-contracts`, etc. Os apps migram gradualmente; um script de lint (`check:no-legacy-imports`) pode ser adicionado depois para forçar a migração completa.

## Risks / Trade-offs

- **[Import circular registry ↔ validation]** → Resolver via `fields.ts` compartilhado antes de mover; teste de contrato garante que `requiredFieldsFor` e `validateToolArguments` continuam consistentes.
- **[Drift entre barrel e packages reais]** → Barrel é gerado por re-exports, não por duplicação; typecheck pega inconsistências.
- **[Scripts com caminhos hardcoded]** → `scripts/check-mcp-catalog.ts` lê `.ts` como texto; atualizar caminhos ou usar o package.
- **[Docker build parcial]** → Se o Dockerfile copia só `apps/api`, o symlink para `packages/*` precisa ser criado no build; documentar no Dockerfile.
- **[Migração longa quebra typecheck]** → Fazer em commits incrementais: primeiro packages novos + barrel, depois migração app por app.

## Migration Plan

1. Criar `packages/tool-registry` com registry, policies, validation, limits (resolvendo circular).
2. Criar `packages/{domain,api-contracts,realtime-contracts,assistant-contracts,ui-contracts}` extraindo de `packages/types`.
3. Manter `packages/types` como barrel de compatibilidade.
4. Migrar `apps/mcp` para importar de `@azy-board/tool-registry`.
5. Migrar `apps/api` para importar de `@azy-board/tool-registry` e packages de tipos.
6. Migrar `apps/web` para packages de tipos.
7. Atualizar scripts e testes.
8. Rodar `bun run check` e `bun run test:mcp-catalog` a cada etapa.

Rollback: reverter commits; barrel mantém compatibilidade durante a transição.

## Open Questions

- Vale adicionar `check:no-legacy-imports` ao CI nesta change ou em uma change posterior?
- `packages/ui-contracts` deve incluir `toCard` e `parseWorkDuration` (funções runtime) ou devem virar utils separados?
