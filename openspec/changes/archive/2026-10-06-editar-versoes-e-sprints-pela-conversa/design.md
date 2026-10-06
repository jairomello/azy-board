## Context

O catálogo compartilhado (`packages/tool-registry`) é a fonte única de campos, schema, validação, policy e descrição das ferramentas usadas tanto pelo MCP quanto pelo harness do Azy Agent. Hoje existem:

- `create_sprint`, `activate_sprint`, `close_sprint`, `list_sprints`, `get_current_sprint`.
- `create_version`, `list_versions`.

A lacuna é de **edição**. As rotas de API já existem e são usadas pela tela de Configurações:

- `PATCH /projects/:id/sprints/:sprintId` (`apps/api/src/routes/sprints.ts`) aceita `name`, `startDate`, `endDate` (parcial), valida datas com `validateSprintDates` e emite `SPRINT_CHANGED`.
- `PATCH /projects/:id/versions/:versionId` (`apps/api/src/routes/versions.ts`) aceita `name`, `releaseDate`, `description`, `status`, `position` via `updateVersionSchema`, e emite `emitProjectMetadata(projectId, 'versions')`.
- `POST /projects/:id/versions` aceita `name`, `releaseDate`, `description`, `status`, mas `create_version` no catálogo expõe apenas `name`.

Restrições relevantes:

- `apps/api/src/services/assistantHarness.ts:parseArguments` descarta valores `null`/`''` no topo dos argumentos, então “limpar um campo” não pode ser expresso por `null` cru.
- O catálogo já tem o padrão de `changes: [{ field, operation, value }]` com `SET`/`CLEAR` em `update_item`, `update_items`, `update_checklist`, `update_checklist_item` e `update_item_log` (spec `mcp-server` — “Schema de alteração próprio por ferramenta”).
- As mutações de planejamento exigem `ADMIN` (policies existentes `admin`), coerentes com as rotas.

## Goals / Non-Goals

**Goals:**
- Permitir que a conversa edite os mesmos campos de versão e sprint disponíveis na tela de Configurações, com paridade de validação e permissão.
- Expressar “definir” e “limpar” de forma explícita e testável, sem depender de `null` cru.
- Mostrar uma prévia “antes → depois” antes da aprovação humana.
- Preservar as regras de ciclo de vida de sprint (edição não transiciona status nem reescreve ciclos).
- Completar `create_version` com os campos que a API já aceita.

**Non-Goals:**
- Excluir versões ou sprints pela conversa (`delete_version`/`delete_sprint`).
- Reordenar versões (`position`).
- Transição coordenada de sprint com prévia (oportunidade 11 do doc).
- Alterar o comportamento de `activate_sprint`/`close_sprint`/`create_sprint`.
- Mudar as rotas de API ou o formulário de Configurações.

## Decisions

### 1. Duas ferramentas novas apoiadas nas rotas `PATCH` existentes

`update_sprint` e `update_version` são finas camadas sobre as rotas já usadas pela tela; o domínio (validação de datas, RBAC, eventos WebSocket) permanece na API.

- **Por que não reaproveitar `update_item`**: a edição é de entidades de planejamento (sprint/versão), não de cards; forçar `update_items` misturaria domínios e não cobriria `description`/`status`/`releaseDate`.
- **Alternativa descartada**: editar via `update_project` — não há campos de versão/sprint no projeto.

### 2. `changes` com `SET`/`CLEAR` para ambas as ferramentas

`update_sprint` e `update_version` recebem `changes: [{ field, operation, value }]` com `operation ∈ {SET, CLEAR}`, no mesmo modelo de `update_item`.

- **Por que não campos planos com `null`**: o harness descarta `null`/`''` no topo (`parseArguments`), então `releaseDate: null` não chegaria como “limpar”. Corrigir isso globalmente arriscaria todas as ferramentas que dependem de `null` ser “não informado”.
- **Por que não um `clearFields: string[]`**: seria um conceito novo só para esta feature, enquanto `CLEAR` já existe e é entendido pelo modelo/harness.
- **Consequência**: o schema de `changes` é próprio por ferramenta (campos permitidos: sprint → `name`/`startDate`/`endDate`; versão → `name`/`releaseDate`/`description`/`status`), atendendo à spec “Schema de alteração próprio por ferramenta”.
- **`CLEAR` restrito**: só é válido para campos anuláveis (`releaseDate`, `description` na versão). `CLEAR` em `name`/`status`/datas de sprint é rejeitado com erro acionável.

### 3. `create_version` com campos planos

Na criação não há semântica de limpar; `create_version` passa a aceitar `releaseDate`, `description` e `status` como campos opcionais planos, espelhando `POST /projects/:id/versions`. Mantém `name` obrigatório.

### 4. Ciclo de vida de sprint intocado

Editar `name`/datas usa apenas o `PATCH` de conteúdo, que preserva status e ciclos (`sprint-management` — “Edição de sprint”). Nenhuma ferramenta nova transiciona status; isso continua em `activate_sprint`/`close_sprint`. Editar as datas de uma sprint `OPEN` não reescreve o baseline do ciclo já aberto — comportamento já existente na tela e mantido por paridade.

### 5. Permissão `ADMIN` derivada da policy existente

As duas ferramentas entram no catálogo com a policy `admin` (mesma das rotas e de `create_sprint`/`create_version`). O harness reutiliza a policy do catálogo; não há verificação de papel paralela.

### 6. Prévia “antes → depois” em pt-BR

Adicionar ramo dedicado em `approvalPreview` para `update_sprint`/`update_version`, renderizando cada `change` como `Campo: valor atual → valor novo` (ou `→ (vazio)` em `CLEAR`). Quando o valor atual não estiver disponível no preview, exibir o valor informado e o rótulo amigável do campo, sem despejar JSON cru.

### 7. Validação acionável e sem persistência parcial

A validação de argumentos rejeita: `changes` vazio; `operation` desconhecida; `CLEAR` em campo não anulável; `status` fora de `PLANNED|IN_DEV|RELEASED|CANCELLED`; datas de sprint ausentes/invertidas (delegado à API `validateSprintDates`, com o erro repassado). Nenhuma escrita parcial.

## Risks / Trade-offs

- **Divergência entre `changes` do agente e campos planos da API** → o adaptador MCP traduz `changes` → corpo plano (com `CLEAR` → `null`); `registry-contract.test.ts` e a suíte MCP cobrem a paridade schema/validador/executor.
- **`changes` aninhado no modo estrito** → reutiliza o padrão já validado dos `changes` existentes (todas as chaves em `required` com tipos anuláveis); teste de campos opcionais garante a forma mínima.
- **Confusão entre editar datas e ciclo analítico** → documentado: edição não altera ciclos; transições seguem exclusivas de `activate_sprint`/`close_sprint`. A prévia deixa explícito que é edição de conteúdo.
- **`status` de versão arbitrário** → a tela permite qualquer transição; mantemos a paridade e não inventamos máquina de estados onde o domínio não tem.
- **Regressão em `create_version`** → campos novos são opcionais; criação só com `name` continua idêntica. Gate `bun run test:mcp-catalog` reprova divergência de schema/dispatch.
- **Erro da API de sprint em datas** → o executor MCP apenas repassa o erro normalizado, sem conversão semântica própria.

## Migration Plan

Mudança aditiva, sem migração de dados. Publicar catálogo → validação → executores MCP → prévia do harness → skill. Rollback = reverter o commit; nenhum dado persistido depende do novo contrato.

## Open Questions

- Expor também `position` em `update_version` (reordenação) ou manter fora de escopo? Decisão inicial: fora, para não ampliar a superfície sem pedido do card.
- A prévia deve resolver e exibir o valor atual real (exige leitura da entidade no harness) ou basta o valor informado? Resolver na implementação priorizando “antes → depois” quando a leitura for barata; nunca bloquear a mutação por falta do valor atual.
