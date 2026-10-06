## Context

Os links externos do item já existem como capacidade de domínio (`item-links`): persistência (`item_links`), rotas `apps/api/src/routes/itemLinks.ts` (`GET`/`POST`/`PATCH`/`DELETE` sob `/projects/:projectId/items/:itemId/links`), validação em `apps/api/src/validation.ts` (`createItemLinkSchema`/`updateItemLinkSchema`) e interface `ItemLinksArea` (T11). O foco do assistente também já publica o link selecionado (`AssistantFocusEntityKind: 'link'`, `agent-focus-resolution`).

O que falta é a paridade no catálogo compartilhado de ferramentas: `packages/tool-registry` não declara nenhuma operação de link, então o agente (MCP e harness do Azy Agent) não consegue listar/criar/editar/remover. O doc `docs/SUGESTOES-EVOLUCAO-AZY-AGENT.md` (oportunidade 6, P1) descreve exatamente essa lacuna e a expectativa de o link aparecer na aba correta “sem o usuário copiar IDs”.

O catálogo é a fonte única de campos, schema, validação, policy e descrição (`mcp-tool-registry`); adicionar uma ferramenta exige tocar as camadas `fields.ts`, `registry.ts`, `policies.ts` e `validation.ts` e, no MCP, os executores (`apps/mcp/src/tools.ts`) e o dispatcher (`apps/mcp/src/registry.ts`), além do README gerado e da skill oficial.

## Goals / Non-Goals

**Goals:**
- Expor `list_item_links`, `create_item_link`, `update_item_link` e `delete_item_link` com paridade entre schema, validação, policy, classificação e executor MCP.
- Reaproveitar as rotas e a validação de URL já existentes na API, sem duplicar regra de negócio.
- Permitir que o agente identifique o link pelo nome/URL a partir de `list_item_links` e confirme a mutação com nome e URL.
- Exibir prévia de aprovação legível para mutações de link no harness.
- Atualizar a aba Links do item aberto quando o agente conclui uma mutação de link, sem recarregamento manual.
- Manter isolamento por tenant/projeto/item (anti-IDOR) e RBAC idênticos à API.

**Non-Goals:**
- Ler, baixar ou interpretar o conteúdo da URL cadastrada ou de páginas/serviços externos.
- Criar grafo de dependências entre cards ou relações tipadas (oportunidade separada).
- Alterar o modelo, as migrações, as rotas, a validação ou a interface de links existentes (já atendem).
- Definir automaticamente o alvo do link apenas pelo foco da tela, quando isso tornar a mutação ambígua.

## Decisions

### 1. Quatro ferramentas espelhando o CRUD da API
Declarar `list_item_links` (`read`), `create_item_link` (`create`), `update_item_link` (`update`) e `delete_item_link` (`delete`), no mesmo padrão nominal de `list_item_logs`/`create_item_log`/`update_item_log` e `list_attachments`.
- **Por que não uma única ferramenta com `operation`**: o catálogo é nominal por operação (`Fonte única de verdade por ferramenta`), e as policies/riscos diferem entre leitura e mutação. Uma tool-fachada contrariaria `adaptive-agent-tool-routing` (“sem substituir tools nominais por uma tool-fachada”).
- **Alternativa descartada**: reutilizar `update_item` com um campo de links — misturaria domínios e não cobriria create/delete com IDs próprios.

### 2. Campos e obrigatoriedade consistentes com a API
- `list_item_links`: `projectId`, `itemId` (obrigatórios).
- `create_item_link`: `projectId`, `itemId`, `name`, `url` (obrigatórios) + `description` (opcional).
- `update_item_link`: `projectId`, `itemId`, `linkId` (obrigatórios) + ao menos um de `name`/`url`/`description`.
- `delete_item_link`: `projectId`, `itemId`, `linkId` (obrigatórios).

`projectId` pode ser omitido quando o projeto padrão da codebase está configurado (mesma convenção das demais ferramentas). `itemId` e `linkId` validados como IDs não vazios. O limite de edição parcial (“ao menos um campo”) é validado no caminho da ferramenta, espelhando o `refine` de `updateItemLinkSchema`.

### 3. Validação de URL compartilhada no tool-registry
Adicionar em `packages/tool-registry/src/validation.ts` a validação de URL de link com a mesma regra da API: `http`/`https`, sem usuário/senha embutidos, ≤ 2048; nome ≤ 200; descrição ≤ 20000. A checagem final continua no servidor (API), que é a autoridade; a validação no catálogo existe para dar erro acionável antes de executar e manter a paridade exigida por `mcp-tool-registry`.
- **Por que não importar o schema Zod da API no tool-registry**: `packages/tool-registry` é consumido pelo MCP e pelo harness e não deve depender de `apps/api`; a regra é pequena e estável, e os testes de contrato garantem que as duas pontas descrevem o mesmo formato.

### 4. Domínio `evidence`, escopo `item`, risco derivado da operação
Classificar as quatro ferramentas como `domain: 'evidence'` (junto de logs/anexos/checklists), `scope: 'item'`, com `operation` `read`/`create`/`update`/`delete`. `list_item_links` entra no conjunto `discovery` por ser leitura de itens do contexto, permitindo o agente carregar a lista antes de editar sem exigir ID do usuário.
- **Por que `evidence` e não `items`**: links são evidência/conteúdo associado ao item, alinhado a logs e anexos; manter o mesmo domínio dá coerência de roteamento.
- **Alternativa descartada**: criar domínio novo `links` — custo de classificação/policy sem ganho de descoberta.

### 5. Policies: leitura para listar; escrita para mutações
`list_item_links: read`; `create_item_link`/`update_item_link`/`delete_item_link`: `write`. As rotas já aplicam `VIEWER`/`MEMBER`; a policy do catálogo é a primeira barreira e o RBAC real permanece no servidor.

### 6. IDs resolvidos por listagem, não por foco implícito
Para “troque a URL da documentação”, o agente chama `list_item_links`, casa por nome/URL e então chama `update_item_link` com o `linkId`. Mutações exigem `linkId` explícito; o alvo não é inferido silenciosamente do foco, evitando alterar o link errado quando houver ambiguidade (`Precedência determinística de alvo`).
- **Consequência**: nenhuma mudança de foco/RBAC é necessária; o link selecionado já é publicado e pode ser usado como contexto de conversa, mas a ferramenta não depende dele.
- **Alternativa descartada**: inferir `itemId`/`linkId` do `activeEntity` no servidor — amplia o escopo para o contrato de foco sem necessidade para o critério do card.

### 7. Confirmação e prévia autoexplicativas
Os executores retornam o registro do link (`id`, `name`, `url`, `description`) e `delete` retorna `{ ok: true }`. O harness adiciona ramo de preview para as mutações, exibindo nome e URL (e descrição) em pt-BR, com hash canônico estável para deduplicação por assinatura já existente.
- **Alternativa descartada**: manter o JSON cru no preview — piora a aprovação e a explicação do agente.

### 8. Aba Links reage ao evento de mutação do assistente
O `ItemLinksArea` passa a assinar `onAssistantMutation` (`apps/web/src/lib/dataEvents.ts`), o mesmo canal já usado por `useBoardData`/`useAssistantCacheInvalidation`, e recarrega os links quando o `toolName` é de mutação de link (`create_item_link`, `update_item_link`, `delete_item_link`). O resultado das ferramentas inclui `itemId`/`projectId` para permitir filtrar pelo item afetado e direcionar a invalidação de cache; na ausência desses campos, o recarregamento é conservador para o item aberto.
- **Por que não migrar `ItemLinksArea` para a camada de cache única agora**: a spec `client-cache` ainda lista as telas migradas (Settings, Projects, TreeView, AdminUsers, ApiKeys); migrar `ItemLinksArea` é um refactor maior e fora do critério do card. O canal de mutação do assistente já é o mecanismo vigente para refletir ações do agente no board.
- **Por que não depender só do `ITEM_UPDATED` via WebSocket**: o payload não carrega links e o componente não tem acesso ao canal; o evento do assistente é entregue na aba e é suficiente para o critério do card.
- **Alternativa descartada**: remontar a modal a cada `ITEM_UPDATED` do board — pesado e sem garantia de refetch da aba de links.

## Risks / Trade-offs

- **Divergência entre validação do catálogo e da API** → teste de contrato (`registry-contract.test.ts`) + validação autoritativa no servidor; a mensagem de erro precisa citar o formato aceito.
- **Ambiguidade de alvo ao editar por nome** → exigir `linkId`; o agente lista e confirma no preview antes da aprovação.
- **URL maliciosa (phishing/xss)** → já mitigado na interface com nova guia `noopener`/`noreferrer` e validação http/https sem credenciais; a ferramenta não acessa a URL.
- **Duplicação entre runs/retries** → o dedup do harness cobre repetição na mesma run; repetição entre runs não é garantida (as rotas de link não têm idempotência). Registrado como limitação, sem promessa de idempotência HTTP.
- **Aumento do catálogo exposto** → quatro ferramentas nominais pequenas; `list_item_links` em `discovery` preserva progressive disclosure e não exige navegação.
- **Regressão em ferramentas existentes** → mudança aditiva; gate `bun run test:mcp-catalog` reprova campos/schema/dispatch inconsistentes.
- **Refetch excessivo da aba Links** → filtrar por `itemId` no resultado da ferramenta; sem filtro, o recarregamento é conservador e ocorre só quando a aba está aberta, custo baixo.

## Migration Plan

Mudança aditiva, sem migração de dados. Ordem de publicação: descritor/validação no catálogo → executores MCP + dispatcher → README gerado → preview no harness → skill. Rollback = reverter o commit; nenhum dado persistido depende do novo contrato. A API e a interface permanecem inalteradas.

## Open Questions

- `apps/api/src/routes/itemLinks.ts` devolve o registro completo no `POST`/`PATCH` e `{ ok: true }` no `DELETE`; confirmar na implementação se o executor precisa de algum ajuste para ecoar `id`/`name`/`url`.
- Vale registrar `list_item_links` também em `planning`/dependências de `update_item_link` (para o roteador carregar a lista antes da edição) ou o `discovery` já é suficiente? Resolver na implementação olhando `dependencyToolsFor`/`selectSharedTools`.
