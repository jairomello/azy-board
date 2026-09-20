## 1. Baseline e garantias antes da refatoração

- [x] 1.1 Capturar o catálogo atual como snapshot (definições de `getSharedToolDefinitions` e o resultado de `withOptionalFields`) em um teste, antes de qualquer mudança.
- [x] 1.2 Listar as divergências reais entre `registry.required`, `registry.fieldsByTool` e `validation.requiredByTool`, registrando a decisão para cada uma (ex.: `create_sprint`, `create_checklist`, `add_checklist_item_to_task`).
- [x] 1.3 Escrever os testes de contrato que hoje falhariam por ausência de fonte única (toda ferramenta com descritor/policy/executor; schema × validação; limites coincidentes).

## 2. Descritor único por ferramenta

- [x] 2.1 Definir os tipos `ToolField` e `ToolDescriptor` em `apps/mcp/src/registry.ts`, declarando tipo, obrigatoriedade, nulabilidade, enum, limite de texto e descrição por campo.
- [x] 2.2 Migrar as ferramentas para descritores, tomando `fieldsByTool` + `required` como base e preservando as descrições atuais dos campos.
- [x] 2.3 Derivar o schema exposto (strict e MCP) dos descritores, removendo `fieldsByTool` como tabela paralela.
- [x] 2.4 Manter `getSharedToolDefinitions`, `requiredFieldsFor`, `SHARED_TOOL_NAMES` e `executeSharedTool` com as assinaturas públicas atuais.

## 3. Routing e nomes derivados

- [x] 3.1 Substituir os conjuntos manuais (`discovery`, `planning`, `projectTools`, `boardTools`, `planningTools`, `collaborationTools`, `evidenceTools`, `destructiveTools`, `createTools`, `updateTools`) por campos do descritor e regras puras de derivação.
- [x] 3.2 Reimplementar `routingFor` a partir do descritor, preservando domain/scope/operation/risk/screens observáveis iguais ao baseline.
- [x] 3.3 Migrar `friendlyNames` e `SKILL_COMMAND_INTENTS` para o descritor ou mantê-los apenas como apresentação derivada do nome.

## 4. Validação e limites derivados

- [x] 4.1 Remover `requiredByTool` de `apps/mcp/src/validation.ts` e passar a obter os obrigatórios de `requiredFieldsFor`.
- [x] 4.2 Fazer o validador aplicar os limites de texto declarados no descritor, sem tabela própria.
- [x] 4.3 Ajustar `apps/mcp/src/limits.ts` para ser referenciado pelos campos do descritor, sem lista paralela de campos.

## 5. Exposição e consumidores

- [x] 5.1 Ajustar `apps/mcp/src/index.ts` para que `withOptionalFields`/`withOptionalProjectId` atuem sobre o schema derivado, sem remontar obrigatórios.
- [x] 5.2 Confirmar que `apps/api/src/services/assistantTools.ts` e `assistantHarness.ts` continuam compilando e se comportando igual, sem mudança de contrato.

## 6. Gate do catálogo no CI

- [x] 6.1 Expandir `scripts/check-mcp-catalog.ts` com as verificações de fonte única (descritor × executor, schema × validação, limites coincidentes).
- [x] 6.2 Adicionar a checagem que reprova código morto reintroduzido nos arquivos do MCP (`false ?`, `if (false)`, switch pós-`return`).
- [x] 6.3 Garantir que o gate roda no CI (job `contracts`) e falha com mensagem apontando a ferramenta ou o campo divergente.

## 7. Verificação final

- [x] 7.1 Confirmar que o snapshot do catálogo bate com o baseline, exceto pelas divergências decididas na etapa 1.2.
- [x] 7.2 Rodar `bun run check` (typecheck + lint + testes + build) e corrigir regressões.
- [x] 7.3 Rodar `bun run test:mcp` e `bun run test:smoke`, e registrar no card (`Board ref: 3481186a-fd35-450a-bd4b-2a9a90ad4f21`) antes de fechar com `complete_task`.
