# Proposal

## Why

O MCP do Azy Board não expõe as opções de visibilidade de níveis do projeto (`hideModules` e `hideEpics`): só o REST (`POST /projects`, `PATCH /projects/:id`) e a tela de configurações as definem. Como as ferramentas de projeto rejeitam campos de topo não declarados, um agente que tenta usar essas opções recebe erro e precisa abandonar a conversa para pedir a mudança na interface. O comportamento já existe ponta a ponta (card T61, REST), então expor no catálogo é acréscimo, não nova regra de negócio.

## What Changes

- Declarar `hideModules` e `hideEpics` como booleanos anuláveis opcionais no catálogo de ferramentas (`packages/tool-registry`) para `create_project`, `update_project` e `create_project_structure`, com descrição em pt-BR por campo.
- Propagar as flags pelo caminho de execução (`packages/tool-execution`), mantendo a semântica já vigente no REST: valem só em projeto `HIERARCHICAL`; em `SIMPLE` permanecem `false`; em `update_project`, ligar uma delas dispara o recolhimento da hierarquia (`collapseProjectHierarchy`), preservando a idempotência de reenvio.
- Acrescentar os dois campos à tipagem de leitura do projeto (`ProjectSummary`), para que `get_project`/`list_projects` declarem o que a API já devolve.
- Atualizar a descrição das ferramentas, regenerar o catálogo de `apps/mcp/README.md` (`bun run generate:docs`) e documentar os dois campos em `skills/azyboard/references/mcp-operations.md`.
- Manter a política vigente de rejeitar campos de topo não declarados e a projeção de tipos anuláveis no modo estrito.

Sem **BREAKING**: são campos opcionais acrescentados a ferramentas existentes; nenhuma rota, contrato REST ou permissão muda. A capability `project-management` não muda — o MCP reutiliza a mesma rota e a mesma semântica do REST.

## Capabilities

### New Capabilities
<!-- Nenhuma capability nova: o comportamento pertence ao catálogo de ferramentas existente. -->

### Modified Capabilities
- `mcp-tool-registry`: novo requisito declarando as opções de visibilidade de níveis (`hideModules`/`hideEpics`) nas ferramentas de projeto, com descrição por campo, validação acionável e paridade com a semântica do REST.

## Impact

- `packages/tool-registry/src/fields.ts` (campos aceitos por ferramenta) e `src/registry.ts` (`schemaFor` com a descrição pt-BR e o texto das descrições das ferramentas).
- `packages/tool-execution/src/http-adapter.ts` (assinatura/encaminhamento de `toolCreateProject` e `toolCreateProjectStructure`; `toolUpdateProject` já repassa as mudanças).
- `apps/mcp/README.md` (bloco gerado do catálogo — regerar) e `skills/azyboard/references/mcp-operations.md` (documentação da skill).
- Testes: contrato do catálogo (`packages/tool-registry/src/registry-contract.test.ts`), campos opcionais e catálogo exposto pelo MCP (`apps/mcp/src/optional-fields.test.ts`, `src/registry.test.ts`), encaminhamento (`packages/tool-execution`) e criação/edição com o recolhimento via MCP.
- Sem mudança de schema de banco, migração, permissão ou API REST: a persistência e o recolhimento já existem.
