# Tasks

## 1. Catálogo: exposição e validação

- [x] 1.1 Adicionar `hideModules` e `hideEpics` à lista `fields` de `create_project`, `update_project` e `create_project_structure` em `packages/tool-registry/src/fields.ts`, sem tocar em `required`; verificar `bun run test:mcp-catalog` e `bun test packages/tool-registry/src/registry-contract.test.ts`.
- [x] 1.2 Adicionar os ramos de `hideModules` e `hideEpics` em `schemaFor` (`packages/tool-registry/src/registry.ts`): booleano anulável quando o campo for opcional, com descrição pt-BR — "Projeto HIERARCHICAL: oculta o nível de módulos no board (padrão false)." e "... o nível de épicos no board (padrão false)."; verificar no `inputSchema` exposto que os campos aparecem como opcionais e que o modo estrito os declara apenas como `required` anulável.
- [x] 1.3 Acrescentar às descrições de `toolDescriptions` (`create_project`, `create_project_structure` e `update_project`) a menção às opções de ocultar níveis, no mesmo idioma do texto atual; verificar `bun run test:mcp-catalog`.
- [x] 1.4 Cobrir no contrato do catálogo (`packages/tool-registry/src/registry-contract.test.ts` e `apps/mcp/src/optional-fields.test.ts`): os três tools expõem os dois campos como opcionais **com descrição**; `required` permanece inalterado; valor não booleano (ex.: `"sim"`) é rejeitado com mensagem acionável apontando o campo; campo de topo não declarado continua rejeitado; `"true"` textual continua aceito pela coerção.

## 2. Execução e tipagem

- [x] 2.1 Propagar as flags no caminho de execução (`packages/tool-execution/src/http-adapter.ts`): acrescentar `hideModules?: boolean | null` e `hideEpics?: boolean | null` à assinatura de `toolCreateProject`, e assinar/repassar as duas em `toolCreateProjectStructure` (que hoje monta o payload com lista explícita de campos); confirmar que `toolUpdateProject` já repassa o patch sem filtro; verificar com teste de encaminhamento que o corpo do `POST`/`PATCH` contém as flags quando informadas e as omite quando não.
- [x] 2.2 Declarar `hideModules?`/`hideEpics?` em `ProjectSummary` (`packages/tool-execution/src/http-adapter.ts`) para a tipagem de leitura corresponder ao que a API devolve; verificar `bun run --cwd apps/web typecheck` e `bun run typecheck` sem erro.

## 3. Paridade de comportamento com o REST

- [x] 3.1 Criação: com as opções informadas em projeto `HIERARCHICAL`, o projeto nasce com os valores e `get_project` os devolve; sem informar, ambos ficam `false`; com `boardMode = SIMPLE` e opção `true`, o projeto persiste `false`. Verificar por teste.
- [x] 3.2 Edição: `update_project` ligando `hideModules`/`hideEpics` recolhe a hierarquia como no REST e aplica o patch na mesma operação, preservando os demais campos; repetir a mesma chamada não gera recolhimento adicional (idempotência). Verificar por teste, incluindo a origem `MCP` na chamada.
- [x] 3.3 Verificação ponta a ponta via MCP: exercitar `tools/call` de `create_project` (com e sem as flags) e de `update_project` (ligando a opção) contra a API, conferindo o estado final por `get_project`.

## 4. Documentação e verificação final

- [x] 4.1 Documentar `hideModules` e `hideEpics` em `skills/azyboard/references/mcp-operations.md` (seções "Hierarquia e modos"/"Mutação"), registrando que só valem em `HIERARCHICAL`, o padrão `false` e o recolhimento ao ligar; verificar `bun run test:agent-skill`.
- [x] 4.2 Regerar o catálogo de `apps/mcp/README.md` com `bun run generate:docs` e confirmar `bun run check:docs`.
- [x] 4.3 Verificação final: `bun run check` e `bun run test:smoke` verdes, e sem regressão nos testes de MCP (`bun run test:mcp`, `bun run test:mcp-catalog`).

## Workflow follow-up

- Se um card do Azy Board for criado para este trabalho, registrar `Board ref: <itemId>` nos artefatos e encerrar o card em uma coluna com `baseStatus` DONE.
