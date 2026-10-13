# Tasks

## 1. Catálogo: campo, descrição e validação

- [x] 1.1 Declarar `dryRun` em `toolFields.delete_project` (`packages/tool-registry/src/fields.ts`), mantendo `projectId` como único obrigatório; verificar `bun run test:mcp-catalog` e `bun test packages/tool-registry/src/registry-contract.test.ts`.
- [x] 1.2 Dar a `dryRun` um ramo próprio em `schemaFor` (`packages/tool-registry/src/registry.ts`) com descrição pt-BR do preview (contagens dos filhos, sem excluir), removendo-o do ramo compartilhado; verificar no `inputSchema` exposto que o campo é opcional, booleano anulável e descrito.
- [x] 1.3 Validar o tipo em `validateToolArguments` (`packages/tool-registry/src/validation.ts`): valor não booleano falha citando `dryRun`, com `"true"`/`"false"` textual ainda aceitos pela coerção.
- [x] 1.4 Cobrir no contrato do catálogo (`packages/tool-registry/src/registry-contract.test.ts` e `apps/mcp/src/optional-fields.test.ts`): campo exposto com descrição; `required` segue só `projectId`; valor inválido rejeitado; `dryRun` encaminhado como `{ dryRun: true }` no `DELETE` e omitido quando ausente.

## 2. Comportamento ponta a ponta

- [x] 2.1 Verificar pelo MCP HTTP (`apps/api/src/mcp-http.test.ts`) que `tools/call` de `delete_project` com `dryRun: true` devolve as contagens e **não** exclui (o projeto continua em `list_projects`/`get_project`), e que a chamada sem `dryRun` exclui de fato.
- [x] 2.2 Confirmar que a pré-visualização exige o mesmo papel ADMIN da exclusão (chamada sem permissão é recusada, com ou sem `dryRun`).

## 3. Documentação e verificação final

- [x] 3.1 Documentar o preview em `skills/azyboard/references/mcp-operations.md` (seção de mutação), deixando claro que `dryRun` só informa contagens e que a confirmação é uma nova chamada sem o campo; verificar `bun run test:agent-skill`.
- [x] 3.2 Regerar o catálogo de `apps/mcp/README.md` (`bun run generate:docs`) e confirmar `bun run check:docs`.
- [x] 3.3 Verificação final: `bun run check` e `bun run test:smoke` verdes, e sem regressão em `bun run test:mcp` / `bun run test:mcp-catalog`.

## Workflow follow-up

- Ao encerrar, validar o comportamento também na instalação publicada (labapps): `tools/call` com `dryRun: true` e sem `dryRun`, conferindo que o preview não exclui.
- Se um card do Azy Board for criado para este trabalho, registrar `Board ref: <itemId>` nos artefatos e encerrar o card em uma coluna com `baseStatus` DONE.
