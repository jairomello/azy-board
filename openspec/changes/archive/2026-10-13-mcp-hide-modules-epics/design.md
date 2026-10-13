# Design

## Context

Inspeção do código atual (read-only):

- **Catálogo (fonte única).** `packages/tool-registry/src/fields.ts` lista os campos aceitos por ferramenta (`toolFields`); `packages/tool-registry/src/registry.ts` monta o `inputSchema` a partir dessa lista (`schemaFor`) e mantém o texto de cada ferramenta (`toolDescriptions`). O modo estrito deriva do mesmo descritor, declarando todos os campos em `required` com tipos anuláveis. Campos de topo não declarados são rejeitados (`additionalProperties: false`).
- Hoje `create_project`, `create_project_structure` e `update_project` **não** declaram `hideModules`/`hideEpics`, embora o REST já os aceite.
- **REST (já pronto, card T61).** `apps/api/src/validation.ts` (`projectFields`) já tem `hideModules`/`hideEpics` booleanos opcionais e os schemas são `.strict()`. `apps/api/src/routes/projects.ts` aplica: na criação, só em `HIERARCHICAL` (senão `false`); no `PATCH`, `hideModules`/`hideEpics` com `false` forçado fora de `HIERARCHICAL` e, ao ligar uma opção, `collapseProjectHierarchy` no `unitOfWork` com o patch na mesma operação (origem registrada como `MCP` quando a chamada vem de API Key).
- **Execução.** `packages/tool-execution/src/http-adapter.ts`: `toolCreateProject` já espalha `...args` no corpo do `POST /projects` (basta o campo existir no catálogo e na assinatura tipada); `toolUpdateProject` repassa `changes` para `PATCH /projects/:id` sem filtrar; `toolCreateProjectStructure` chama `toolCreateProject` com uma lista **explícita** de campos e por isso não propagaria as flags sem alteração.
- **Coerção.** `packages/tool-registry/src/coercion.ts` converte string `"true"`/`"false"` em boolean e preserva o restante — um valor como `"sim"` chega intacto à validação e é rejeitado.
- **Leitura.** `ProjectSummary` (em `http-adapter.ts`) não declara os dois campos, mas `GET /projects/:id` já os devolve (coberto por `apps/api/src/integration.test.ts`).
- **Docs.** `apps/mcp/README.md` tem o catálogo gerado (`buildMcpCatalogBlock`) validado por `check:docs`; `skills/azyboard/references/mcp-operations.md` documenta as ferramentas por tema (seções "Hierarquia e modos" e "Versões e sprints").

## Goals / Non-Goals

**Goals:**
- Expor as duas opções nas três ferramentas de projeto, com descrição por campo em pt-BR.
- Fazer o caminho MCP ter exatamente a mesma semântica do REST (inclusive o recolhimento), sem duplicar regra de negócio.
- Manter o catálogo como fonte única: nenhuma lista paralela de campos, nenhuma regra nova no servidor.

**Non-Goals:**
- Não alterar o REST, o schema de banco ou permissões (a regra vigente já cobre MCP).
- Não expor as opções em ferramentas de leitura além da tipagem de resposta (`get_project`/`list_projects` já devolvem os campos).
- Não mudar a política de campos de topo não declarados nem o comportamento do modo estrito além da projeção anulável derivada.

## Decisions

### D1. Declarar os campos no catálogo, não no adaptador
`hideModules` e `hideEpics` entram em `toolFields` para as três ferramentas e ganham ramo próprio em `schemaFor` (`nullable({ type: 'boolean' })` com descrição pt-BR). É o único ponto que precisa mudar para exposição, validação e modo estrito ficarem coerentes (`mcp-tool-registry` → "Fonte única de verdade por ferramenta" e "Schema e validação derivados"). Alternativa: validar no adaptador HTTP — rejeitada por criar lista paralela e divergir do schema exposto.

### D2. Reusar a rota REST; zero regra nova no caminho MCP
`toolCreateProject` já espalha os argumentos e `toolUpdateProject` já repassa o patch, então a propagação é consequência da declaração (mais a atualização das assinaturas tipadas). O recolhimento continua sendo decidido no `PATCH /projects/:id`, que já marca a origem como `MCP` quando a chamada vem de API Key. Alternativa: duplicar o recolhimento no `tool-execution` — rejeitada por criar dois donos da mesma regra e risco de divergência com o REST.

### D3. `create_project_structure` propaga explicitamente
Como essa ferramenta monta o payload com lista explícita, adicionamos as flags à sua assinatura e as repassamos a `toolCreateProject`, mantendo paridade entre as três ferramentas que criam projeto. Alternativa: deixar sem os flags (era o estado anterior) — rejeitada por manter assimetria silenciosa entre ferramentas que criam o mesmo recurso.

### D4. Tipagem de leitura fiel
`ProjectSummary` passa a declarar `hideModules?`/`hideEpics?` (opcionais, como os demais campos) para que o contrato tipado corresponda ao que a API devolve; sem mudança de payload.

### D5. Descrição de campo em pt-BR, texto da ferramenta no idioma atual
As descrições por campo seguem o padrão pt-BR já usado em `advancedChecklists`; o texto das ferramentas (`toolDescriptions`, hoje em inglês) recebe a menção às opções no mesmo idioma, evitando mistura dentro da mesma frase. O catálogo gerado de `apps/mcp/README.md` é regerado para acompanhar (`bun run generate:docs`).

## Risks / Trade-offs

- **Divergência entre MCP e REST** → nenhuma regra nova no caminho MCP: a validação de negócio permanece no `PATCH`/`POST` do REST.
- **Recolhimento disparado por engano** → a opção só age quando o valor passa de `false` para `true` (mesma condição do REST) e exige projeto `HIERARCHICAL`; o teste de reenvio cobre a idempotência.
- **Esquecer a regeração do catálogo** → `check:docs` falha se `apps/mcp/README.md` divergir do registry; a regeneração é passo explícito nas tarefas.
- **Campos novos entrarem no modo estrito como obrigatórios** → `schemaFor` marca o campo como anulável quando não obrigatório; o teste de campos opcionais (`apps/mcp/src/optional-fields.test.ts`) valida que só os realmente obrigatórios aparecem em `required`.
- **Coerção mascarar valor inválido** → a coerção só converte `"true"`/`"false"`; qualquer outro texto segue para a validação e é rejeitado com erro acionável (cenário coberto no spec).

## Migration Plan

Sem migração de dados e sem mudança de schema: persistência e recolhimento já existem. Deploy normal das imagens `api` e `mcp`. Rollback: reverter o commit; nenhum estado novo persiste.

## Open Questions

Nenhuma que altere specs, abordagem ou tarefas.
