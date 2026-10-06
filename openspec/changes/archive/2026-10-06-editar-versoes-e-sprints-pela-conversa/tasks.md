## 1. Catálogo compartilhado

- [x] 1.1 Adicionar `update_sprint` e `update_version` a `packages/tool-registry/src/fields.ts` (`projectId`, `sprintId`/`versionId`, `changes`), com os campos permitidos por ferramenta no `nested`
- [x] 1.2 Expandir `toolFields.create_version` com `releaseDate`, `description` e `status` opcionais em `fields.ts`
- [x] 1.3 Declarar os schemas de `changes` próprios por ferramenta em `packages/tool-registry/src/registry.ts` (`update_sprint`: `name`/`startDate`/`endDate`; `update_version`: `name`/`releaseDate`/`description`/`status`) e ligá-los no ramo de montagem do `inputSchema`
- [x] 1.4 Adicionar descrições, `friendlyNames` e classificação (`planning`/`project`/`update`) de `update_sprint` e `update_version` em `registry.ts`
- [x] 1.5 Adicionar `update_sprint` e `update_version` à policy `admin` em `packages/tool-registry/src/policies.ts`
- [x] 1.6 Implementar em `packages/tool-registry/src/validation.ts` a validação dos `changes`: operação `SET`/`CLEAR`, `CLEAR` só em campo anulável, `status` no enum, `changes` não vazio, com mensagem acionável
- [x] 1.7 Ajustar `schemaFor`/`create_version` para expor `releaseDate`, `description` e `status` com os tipos e limites corretos

## 2. Executor MCP

- [x] 2.1 Implementar `toolUpdateSprint` e `toolUpdateVersion` em `apps/mcp/src/tools.ts`, traduzindo `changes` para o corpo plano das rotas `PATCH` (com `CLEAR` → `null` em `update_version`)
- [x] 2.2 Ampliar `toolCreateVersion` para repassar `releaseDate`, `description` e `status` quando informados
- [x] 2.3 Adicionar os `case 'update_sprint'`/`case 'update_version'` e ajustar o `case 'create_version'` em `apps/mcp/src/registry.ts`
- [x] 2.4 Conferir as rotas `PATCH` de `apps/api/src/routes/sprints.ts` e `versions.ts` quanto a retorno e eventos (`SPRINT_CHANGED`/`emitProjectMetadata`) e repassar erros normalizados sem conversão própria
- [x] 2.5 Regerar a documentação do catálogo (`apps/mcp/README.md`) e rodar `bun run test:mcp-catalog`

## 3. Prévia e aprovação no harness

- [x] 3.1 Adicionar ramo de `approvalPreview` para `update_sprint`/`update_version` em `apps/api/src/services/assistantHarness.ts`, exibindo “antes → depois” em pt-BR com rótulo amigável, sem JSON cru
- [x] 3.2 Garantir que a canonicalização/hash usem os mesmos `changes` do preview e que a policy `ADMIN` seja aplicada
- [x] 3.3 Cobrir que alvo ambíguo gera pergunta e que rejeição da prévia não executa a ferramenta

## 4. Testes de contrato

- [x] 4.1 Estender `packages/tool-registry/src/registry-contract.test.ts` com a paridade schema/validação/dispatch de `update_sprint`/`update_version` e a expansão de `create_version`
- [x] 4.2 Estender `apps/mcp/src/optional-fields.test.ts` verificando a forma mínima (`projectId` + id + `changes`) e os campos opcionais de `create_version`
- [x] 4.3 Adicionar testes de validação: `changes` vazio, `operation` desconhecida, `CLEAR` em campo não anulável, `status` inválido e datas de sprint invertidas
- [x] 4.4 Adicionar teste do executor MCP cobrindo a tradução `changes` → corpo plano e `CLEAR` → `null`

## 5. Skill e documentação

- [x] 5.1 Documentar `update_sprint` e `update_version` em `skills/azyboard/SKILL.md` e `skills/azyboard/references/mcp-operations.md` (formato `changes`, `SET`/`CLEAR`, campos por entidade, exigência `ADMIN`, edição não transiciona status)
- [x] 5.2 Documentar `create_version` com `releaseDate`/`description`/`status` na skill
- [x] 5.3 Sincronizar o espelho `.opencode/skills/azyboard/` e rodar `bun run test:agent-skill`

## 6. Verificação e encerramento

- [x] 6.1 Rodar `bun run check` (typecheck + lint + testes + build) e corrigir regressões
- [x] 6.2 Rodar `bun run test:smoke` para o fluxo web/API
- [x] 6.3 Confirmar que a mudança OpenSpec registra `Board ref: 96126546-6215-4438-bed7-4619e78a18af` (T24)
