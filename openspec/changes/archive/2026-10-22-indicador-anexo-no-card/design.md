# Design

## Context

Ver `proposal.md` — Why. Pontos do estado atual que condicionam a abordagem (verificados no código em 22/10/2026):

- O rodapé do card (`apps/web/src/components/KanbanCard.tsx`, ~linhas 357-400) já renderiza indicadores no padrão "ícone + número" — subtarefas (`childrenCount` com `GitBranch`) e dependências (`dependencyCount` com `Workflow`) — **omitidos quando zero**. O tipo do card é `CardData`, declarado no próprio arquivo e estendido por `ItemData` em `apps/web/src/features/board/model/types.ts`.
- A projeção que alimenta o board é `GET /projects/:projectId/items` (`apps/api/src/routes/items.ts:246`), consumida por `apps/web/src/features/board/hooks/useBoardData.ts`. Ela calcula `childrenCount` a partir dos itens já carregados (`childrenCountMap`, sem consulta extra) e obtém progresso de checklist e dependências por agregados de projeto.
- O agregado de anexos já existe: `persistence.files.listAttachmentsByProject(context, projectId)` (`apps/api/src/persistence/ports.ts:310`) é o que alimenta a aba "Todos os anexos" do Planejamento do projeto.
- O habilitador por tenant é lido por `persistence.attachmentSettings.get(tenantId)` (`apps/api/src/routes/attachments.ts`, requisito "Configuração de anexos habilitada por tenant").
- `KanbanCard` é usado por `features/board/components/BoardColumns.tsx` e por `BoardScreen.tsx` (pré-visualização do card), então o indicador alcança os dois sem alteração nesses arquivos.
- O tipo compartilhado `Card` de `@azy-board/ui-contracts` também lista `childrenCount`, mas **não** lista `dependencyCount` nem `checklistProgress` — o contrato efetivamente usado pelo board é o `CardData` local.

## Goals / Non-Goals

**Goals:**

- Exibir clipe + contador no card do board apenas quando houver anexo, preservando o padrão visual dos indicadores vizinhos.
- Obter a contagem sem N+1 e sem nova consulta por card.
- Não exibir o indicador quando a capacidade de anexos está desabilitada no tenant.

**Non-Goals:**

- Contador na aba "Anexos" do modal do item: exigiria subir para o `ItemModal` a lista que hoje é carregada dentro do `AttachmentsArea`.
- Alinhar o tipo compartilhado `Card` de `ui-contracts` com `CardData` (divergência pré-existente, fora deste escopo).
- Levar a contagem para a projeção do agente (`GET /projects/:id/board`, em `apps/api/src/routes/projects.ts`), que tem outro recorte e serve descoberta do agente.
- Tornar o indicador clicável ou filtrar por anexos.

## Decisions

**Contagem derivada do agregado de projeto, agrupada por `itemId`.** Uma única chamada a `listAttachmentsByProject` e um `Map<itemId, count>` por request, no mesmo formato do `childrenCountMap` que já existe no arquivo. Alternativa considerada: `EXISTS`/booleano por item — rejeitada porque o custo é o mesmo (a leitura do projeto domina) e o número é mais informativo que "tem/não tem".

**Gating no servidor, não no cliente.** Quando `attachmentSettings.get(tenantId)` indica desabilitado, a projeção **não expõe** o campo. Alternativa considerada: o cliente consultar `/tenant/attachments/enabled` (como o `ItemModal` faz) — rejeitada porque adicionaria uma chamada e um estado de carregamento ao board para decidir exibir um ícone; omitir no servidor mantém o cliente sem lógica de tenant.

**Campo no `CardData` local, não no contrato compartilhado.** `attachmentCount` é um número, não uma forma compartilhada como `ChecklistProgress`. Acrescentá-lo a `ui-contracts.Card` criaria uma segunda fonte de verdade para um tipo que já está divergente da projeção real. Alternativa considerada: promover `CardData` para `ui-contracts` — refatoração maior, sem relação com o pedido.

**Indicador omitido quando zero.** Mesma convenção de `childrenCount` e `dependencyCount`, com `title` e `aria-label` traduzidos nos três idiomas.

## Risks / Trade-offs

- [A projeção de `/items` passa a ler `attachmentSettings` por request] → A leitura já existe em outros caminhos da API e é uma consulta única por request; se virar custo medido, o port pode ganhar cache por tenant sem mudar o contrato do payload.
- [Projetos com muitos anexos carregam a lista inteira do projeto para contar] → Aceitável no volume atual (é a mesma leitura que a aba "Todos os anexos" já faz sob demanda). Se virar problema, o caminho é um agregado `GROUP BY item_id` no port de arquivos, sem alterar o payload.
- [O `KanbanCard` entra no chunk do board; importar mais um ícone do `lucide-react` pode afetar o orçamento de bundle] → Verificar com `bun run check:bundle`; se estourar, considerar agrupar o ícone no catálogo já existente (`apps/web/src/lib/iconCatalog.ts`) em vez de import direto.
- [Divergência entre `ui-contracts.Card` e `CardData` continua existindo] → Registrada como Non-Goal; não piora com esta mudança, que só adiciona um campo no tipo efetivamente usado.

## Migration Plan

Sem migração de dados. Mudança aditiva no payload, consumida só pelo board. Deploy é a substituição dos artefatos; rollback é reverter o commit. `Board ref: 34e8d51f-a541-4853-a91e-9873d47c31a4` (card T84).
