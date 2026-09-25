## 1. Foundation — packages de tipos

- [x] 1.1 Criar `packages/domain` extraindo enums de entidade (`TaskStatus`, `ColumnBaseStatus`, `Priority`, `ItemType`, `MemberRole`, `GlobalGroup`, `BoardMode`, `SprintStatus`, `NodeType`, `ProjectVisibility`, `ActivityActorType`, `ActivitySource`) de `packages/types/src/index.ts`
- [x] 1.2 Criar `packages/api-contracts` extraindo transporte/erros/auth (`ErrorDetails`, `ApiErrorPayload`, `JwtPayload`, `RequestContext`)
- [x] 1.3 Criar `packages/realtime-contracts` extraindo tipos WebSocket (`WsEventType`, `WsEvent`)
- [x] 1.4 Criar `packages/assistant-contracts` extraindo contratos do assistente (linhas 203–304) + `assistantLimits.ts`, corrigindo `AssistantProvider` para `'OPENAI' | 'OPENOPENROUTER'`
- [x] 1.5 Criar `packages/ui-contracts` extraindo preferências de UI, board adapter (`AncestorNode`, `Card`, `toCard`), checklists e funções de apresentação (`parseWorkDuration`, `formatWorkDuration`)
- [x] 1.6 Transformar `packages/types/src/index.ts` em barrel de compatibilidade re-exportando todos os novos packages
- [x] 1.7 Rodar `bun run typecheck` e `bun test --isolate` para validar que o barrel não quebra nada

## 2. Tool registry package

- [x] 2.1 Criar `packages/tool-registry` com estrutura de submódulos: `registry.ts`, `policies.ts`, `validation.ts`, `limits.ts`, `fields.ts` (resolve circular registry ↔ validation)
- [x] 2.2 Mover `apps/mcp/src/registry.ts` (definições, schemas, classificações, descrições) para `packages/tool-registry/src/registry.ts`, separando `executeSharedTool`/dispatch HTTP para `apps/mcp/src/tools.ts`
- [x] 2.3 Mover `apps/mcp/src/policies.ts`, `validation.ts`, `limits.ts` para `packages/tool-registry/src/`
- [x] 2.4 Mover testes de contrato (`registry-contract.test.ts`, `optional-fields.test.ts`) para `packages/tool-registry/src/`
- [x] 2.5 Atualizar `apps/mcp` para importar de `@azy-board/tool-registry` e manter `executeSharedTool` em `apps/mcp/src/tools.ts`
- [x] 2.6 Rodar `bun run test:mcp` e `bun run test:mcp-catalog` para validar a extração

## 3. Migração de apps

- [x] 3.1 Migrar `apps/api` para importar de `@azy-board/tool-registry` (substituir imports `../../../mcp/src/{registry,policies,validation}.js`)
- [x] 3.2 Migrar `apps/api` para imports de packages de tipos (domain, api-contracts, realtime-contracts, assistant-contracts, ui-contracts)
- [x] 3.3 Migrar `apps/web` para imports de packages de tipos, eliminando tipos locais duplicados (`Column`, `Sprint`, `ProjectContext` em `features/board/model/types.ts` e `features/project-settings/model/types.ts`)
- [x] 3.4 Migrar `apps/mcp` para imports de packages de tipos
- [x] 3.5 Atualizar `scripts/docs/generators.ts` e `scripts/check-mcp-catalog.ts` para importar de `@azy-board/tool-registry`
- [x] 3.6 Atualizar `package.json` de cada app com dependências declaradas (`@azy-board/domain`, `@azy-board/tool-registry`, etc.)

## 4. Correções de drift e limpeza

- [x] 4.1 Eliminar `type ProviderName = 'OPENAI' | 'OPENOPENROUTER'` local em `apps/api/src/routes/assistant.ts:38`, usando `AssistantProvider` de `@azy-board/assistant-contracts`
- [x] 4.2 Eliminar tipo local `ItemType` em `apps/api/src/evals/types.ts:22`
- [x] 4.3 Eliminar espelho `RequestContext`/`MemberRole` em `apps/api/src/types/hono.ts`, importando de `@azy-board/api-contracts`
- [x] 4.4 Eliminar tipos locais duplicados de frontend (`RootAssistantSettings.tsx`, `BoardCommandBar.tsx`, `BoardFilters.tsx`)
- [x] 4.5 Atualizar `tsconfig.base.json` e `paths` dos apps para refletir os novos packages

## 5. Verificação e encerramento

- [x] 5.1 Rodar `bun run check` (typecheck + lint + persistência + testes + build) e corrigir divergências
- [x] 5.2 Rodar `bun run test:mcp-catalog` e `bun run test:error-contract`
- [x] 5.3 Rodar `bun run test:regression --with-e2e` confirmando que nada quebrou
- [x] 5.4 Rodar `openspec validate extract-shared-contracts`
- [x] 5.5 Registrar `Board ref: bd924277-9184-453a-88e6-7fe596af7b29` nos artefatos e fechar o card com `complete_task`
