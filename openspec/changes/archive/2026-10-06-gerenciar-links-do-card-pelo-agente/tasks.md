## 1. Descritor no catálogo compartilhado

- [x] 1.1 Adicionar `list_item_links`, `create_item_link`, `update_item_link` e `delete_item_link` a `toolFields` em `packages/tool-registry/src/fields.ts`, com `projectId`/`itemId`/`linkId`/`name`/`url`/`description` e obrigatoriedade conforme o design
- [x] 1.2 Declarar descrições, uso no `schemaFor` (campos de link) e classificações `{ domain: 'evidence', scope: 'item', operation }` em `packages/tool-registry/src/registry.ts`, incluindo `list_item_links` em `discovery`
- [x] 1.3 Definir policies em `packages/tool-registry/src/policies.ts`: `list_item_links` como `read`; criar/editar/remover como `write`
- [x] 1.4 Implementar em `packages/tool-registry/src/validation.ts` a validação do campo `linkId` (ID não vazio) e da URL de link (`http`/`https`, sem credenciais, ≤ 2048), além de exigir ao menos um campo em `update_item_link`, com mensagens acionáveis alinhadas à API

## 2. Executores MCP e documentação gerada

- [x] 2.1 Implementar `toolListItemLinks`, `toolCreateItemLink`, `toolUpdateItemLink` e `toolDeleteItemLink` em `apps/mcp/src/tools.ts`, chamando as rotas `/projects/:projectId/items/:itemId/links`
- [x] 2.2 Registrar os imports e os `case`s correspondentes no dispatch de `apps/mcp/src/registry.ts`
- [x] 2.3 Regenerar a documentação do catálogo (`apps/mcp/README.md`) e rodar `bun run test:mcp-catalog`
- [x] 2.4 Conferir o retorno das rotas em `apps/api/src/routes/itemLinks.ts` (`POST`/`PATCH` devolvem o registro; `DELETE` devolve `{ ok: true }`) e ajustar os executores para ecoar `id`/`name`/`url` e `itemId`/`projectId` na confirmação

## 3. Prévia e anti-duplicação no harness

- [x] 3.1 Adicionar ramo de preview para `create_item_link`/`update_item_link`/`delete_item_link` em `apps/api/src/services/assistantHarness.ts`, exibindo nome e URL (e descrição) em pt-BR
- [x] 3.2 Garantir que `canonicalArguments`/hash usam o payload canônico das mutações de link, e que repetição equivalente na run é tratada como a mesma operação
- [x] 3.3 Cobrir em teste que edição/remoção exige `linkId` resolvido por listagem e que alvo ambíguo não é inferido silenciosamente

## 4. Atualização da aba Links (web)

- [x] 4.1 Fazer `apps/web/src/components/ItemLinksArea.tsx` assinar `onAssistantMutation` e recarregar os links quando a ferramenta for de mutação de link, filtrando por `itemId`/`projectId` quando presentes
- [x] 4.2 Cobrir as ferramentas de link em `apps/web/src/hooks/useAssistantCacheInvalidation.ts` para direcionar a invalidação ao projeto correto
- [x] 4.3 Adicionar teste web da reação da aba Links (recarrega em mutação de link do item exibido; ignora outro item/outra ferramenta)

## 5. Testes de contrato

- [x] 5.1 Estender `packages/tool-registry/src/registry-contract.test.ts` com paridade schema/validação/policy/classificação/dispatch das quatro ferramentas de link, incluindo a rejeição de URL inválida e de `update_item_link` sem campos
- [x] 5.2 Estender `apps/mcp/src/optional-fields.test.ts` verificando os campos obrigatórios e opcionais de cada ferramenta de link
- [x] 5.3 Estender `apps/mcp/src/tools.test.ts` (e `registry.test.ts` para routing/dependências) com os fluxos de listar/criar/editar/remover, erro de URL inválida e confirmação de nome/URL
- [x] 5.4 Adicionar teste do harness para a prévia legível e a não duplicação por repetição

## 6. Skill e documentação

- [x] 6.1 Documentar as operações de link em `skills/azyboard/SKILL.md` e `skills/azyboard/references/mcp-operations.md`, com exemplos mínimos e a regra de resolver `linkId` via `list_item_links`
- [x] 6.2 Registrar na skill que cadastrar URL não lê nem acessa o conteúdo externo
- [x] 6.3 Sincronizar o espelho `.opencode/skills/azyboard/` e rodar `bun run test:agent-skill`

## 7. Verificação e encerramento

- [x] 7.1 Rodar `bun run check` (typecheck + lint + testes + build) e corrigir regressões
- [x] 7.2 Rodar `bun run test:smoke` para o fluxo web/API
- [x] 7.3 Registrar `Board ref: 22720b47-7a96-4d5d-b5da-12f04e522b21` (T22) e, ao concluir a implementação, fechar o card com `complete_task` confirmando `status` DONE no board real
