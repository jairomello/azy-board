## Why

O Azy Board já oferece CRUD de links externos do item pela API (`itemLinksRouter`) e pela interface do card (T11), mas o catálogo compartilhado de ferramentas não expõe nenhuma operação de link ao agente. Hoje, um pedido como “adicione este link do Figma ao card” ou “troque a URL da documentação” não tem ferramenta correspondente em `toolFields`; o agente não consegue listar, criar, editar nem remover links, apesar de a lacuna ser de baixo esforço. O card **T22 — Gerenciar links do card pelo agente** fecha essa lacuna na mesma trilha do doc `docs/SUGESTOES-EVOLUCAO-AZY-AGENT.md` (oportunidade 6: “Gerenciar links do card pelo chat”, P1, integração).

**Board ref:** `22720b47-7a96-4d5d-b5da-12f04e522b21` (T22 - Gerenciar links do card pelo agente, coluna "Backlog").

## What Changes

- **Quatro ferramentas MCP de links**: expor `list_item_links`, `create_item_link`, `update_item_link` e `delete_item_link`, espelhando o CRUD já existente em `itemLinksRouter` (`GET`/`POST`/`PATCH`/`DELETE /projects/:projectId/items/:itemId/links`). Cada operação SHALL ser declarada no descritor único de `packages/tool-registry` (campos, schema, validação, policy, routing, descrição).
- **Contrato de campos**: `list_item_links` e `delete_item_link` exigem `projectId` e `itemId` (mais `linkId` em delete); `create_item_link` exige `name` e `url` e aceita `description` opcional; `update_item_link` exige `linkId` e aceita ao menos um de `name`/`url`/`description`.
- **Validação de URL no caminho da ferramenta**: a URL SHALL aceitar apenas `http`/`https`, sem credenciais embutidas, com os mesmos limites da API (nome ≤ 200, URL ≤ 2048, descrição ≤ 20000), rejeitando entradas inválidas de forma acionável e sem executar a mutação.
- **Paridade com a API e RBAC**: leitura exige acesso de leitura ao projeto; criação/edição/remoção exigem permissão de escrita (MEMBER/ADMIN), com isolamento por tenant/projeto/item (anti-IDOR), reaproveitando as rotas existentes.
- **Confirmação autoexplicativa**: as respostas de mutação exibem nome e URL do link afetado (e o `id`), permitindo confirmar o resultado sem releitura pesada.
- **Prévia de aprovação legível**: o harness do Azy Agent exibe nome e URL (e a descrição, quando houver) nas prévias de criação/edição/remoção de link, em vez de despejar o JSON cru.
- **Atualização da aba Links após execução**: após uma mutação de link concluída pelo agente, a aba Links do item SHALL refletir a mudança sem recarregamento manual, reagindo ao evento de mutação do assistente já emitido pelo Azy Agent Drawer e recarregando apenas os links do item afetado.
- **Sem leitura do conteúdo externo**: cadastrar uma URL NÃO implica baixar, interpretar nem acessar o serviço externo; a ferramenta apenas persiste metadados (nome, URL, descrição).
- **Documentação**: catálogo MCP gerado (`apps/mcp/README.md`) e skill oficial descrevem as operações de link e a regra de alvo (item em foco) sem exigir que o usuário copie IDs.
- **Sem BREAKING**: as ferramentas são aditivas; a API, o modelo e a interface existentes permanecem inalterados.

**Fora de escopo:** leitura/extração de conteúdo de anexos ou de páginas externas, grafo de dependências entre cards, data retroativa, e demais oportunidades do doc de evolução.

## Capabilities

### New Capabilities

<!-- Nenhuma nova capability: a mudança completa contratos existentes. -->

### Modified Capabilities

- `mcp-tool-registry`: o descritor passa a declarar as ferramentas `list_item_links`, `create_item_link`, `update_item_link` e `delete_item_link`, com campos obrigatórios/opcionais, validação de URL e de `linkId`, classificação `evidence`/`item`, policy correspondente e documentação gerada.
- `mcp-server`: as quatro ferramentas de link passam a ser expostas pelo transporte MCP, com paridade schema/validação/executor, confirmação de nome e URL e erros normalizados.
- `azy-agent-harness`: a prévia de aprovação de mutações de link exibe nome e URL (e descrição) de forma legível, com hash/assinatura estável por payload canônico.
- `official-agent-skill`: a skill documenta como listar, criar, editar e remover links do item em foco, sem exigir que o usuário copie IDs.
- `client-cache`: componentes que exibem recursos do item (links) reagem a mutações concluídas pelo assistente, refazendo a consulta do recurso afetado sem recarregamento manual.

## Impact

- **Catálogo compartilhado**: `packages/tool-registry/src/fields.ts` (quatro entradas novas), `registry.ts` (descrições, `schemaFor` para os campos de link, classificações `evidence`/`item` e inclusão de `list_item_links` em `discovery`), `policies.ts` (leitura para listar; escrita para criar/editar/remover) e `validation.ts` (validação de `linkId` e da URL HTTP/HTTPS sem credenciais).
- **MCP**: `apps/mcp/src/tools.ts` (executores `toolListItemLinks`, `toolCreateItemLink`, `toolUpdateItemLink`, `toolDeleteItemLink`), `apps/mcp/src/registry.ts` (imports e `case`s no dispatch) e README gerado (`apps/mcp/README.md`).
- **API**: rotas `apps/api/src/routes/itemLinks.ts` já cobrem o CRUD; conferir apenas o formato de resposta consumido pelos executores e a validação em `apps/api/src/validation.ts` (`createItemLinkSchema`/`updateItemLinkSchema`).
- **Harness do agente**: `apps/api/src/services/assistantHarness.ts` (`approvalPreview`/`canonicalArguments` com ramo para mutações de link).
- **Web**: `apps/web/src/components/ItemLinksArea.tsx` (reagir a `onAssistantMutation` e recarregar os links do item afetado) e `apps/web/src/hooks/useAssistantCacheInvalidation.ts` (cobrir as ferramentas de link); opcionalmente `apps/web/src/lib/dataEvents.ts` se o evento precisar de dados de alvo.
- **Skill**: `skills/azyboard/SKILL.md`, `skills/azyboard/references/mcp-operations.md` e espelho `.opencode/skills/azyboard/`.
- **Testes**: `packages/tool-registry/src/registry-contract.test.ts`, `apps/mcp/src/tools.test.ts`, `apps/mcp/src/optional-fields.test.ts`, `apps/mcp/src/registry.test.ts` (routing/dependências), testes do harness, testes web de `ItemLinksArea`/invalidação e `bun run test:agent-skill`; verificação final com `bun run check`, `bun run test:mcp-catalog` e `bun run test:smoke`.
