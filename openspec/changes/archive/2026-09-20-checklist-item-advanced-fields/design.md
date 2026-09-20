## Context

Itens de checklist hoje são `{ id, text, checked, position }`, definidos em `apps/api/src/db/schema.ts` (`checklistItems`), expostos por `apps/api/src/routes/checklists.ts` e embutidos no detalhe do card (`apps/api/src/routes/items.ts`). O frontend renderiza e edita em `apps/web/src/components/ChecklistSection.tsx`, dentro da aba de checklists do `ItemModal`. O projeto não possui um contêiner genérico de configurações: opções por projeto são colunas explícitas em `projects` (por exemplo `board_mode`, `is_restricted`), com `PATCH /projects/:id` restrito a ADMIN (`apps/api/src/routes/projects.ts`). As regras de texto e os contratos são compartilhados com o MCP (`apps/mcp/src/registry.ts`, `tools.ts`, `limits.ts`).

O card T5 pede campos avançados **opcionais por projeto** nos itens de checklist, com o modo simples como padrão e sem tornar nada obrigatório. A implementação atravessa banco, API, web, MCP, i18n e testes, por isso exige decisões explícitas antes de codar.

Board ref: `e067830d-e34d-4e18-b119-7941b3df7e40`.

## Goals / Non-Goals

**Goals:**

- Um gate por projeto (`advancedChecklists`) que liga/desliga data, responsável e descrição nos itens de checklist.
- Campos avançados **não obrigatórios**, com validação de membro do projeto para o responsável.
- Modo simples como padrão e comportamento atual rigorosamente preservado.
- Desligar o gate sem perda de dados (reativação restaura).
- Exposição consistente na API, no board/detalhe, no WebSocket e no MCP.
- UI com data, responsável e ícone de notas que abre modal de descrição rich text com barra de formatação.
- Textos nos 3 idiomas e testes cobrindo gate, validação, payload e migração.

**Non-Goals:**

- Converter itens de checklist em subtarefas do Kanban.
- Notificações, lembretes ou alertas por `dueDate`.
- Tornar data, responsável ou descrição obrigatórios.
- Recorrência, checklist por template ou múltiplas datas por item.
- Mover esses campos para um contêiner genérico de settings de projeto.

## Decisions

### 1. Gate como coluna booleana em `projects`

Adicionar `advanced_checklists` (booleano, `NOT NULL DEFAULT false`) em `projects`, seguindo o padrão de `board_mode`/`is_restricted`, em vez de criar um JSON de settings ou tabela de feature flags. Mantém tipagem Drizzle, migração append-only simples e a validação já existente em `updateProjectSchema`/`createProjectSchema`. Alteração apenas por ADMIN via `PATCH /projects/:id`; leitura pública do projeto/board.

Alternativa considerada: tabela genérica `project_settings` — rejeitada por introduzir um padrão novo para uma única flag e aumentar o escopo.

### 2. Campos nullable em `checklist_items`

Adicionar `due_date` (texto ISO, nullable), `assignee_id` (texto, nullable) e `description` (texto, nullable). `due_date` e `description` são `ALTER TABLE ... ADD COLUMN`; `assignee_id` traz FK composta para `users(tenant_id, id)` no padrão de `items.assigneeFk` e, no SQLite, exige o rebuild de tabela já usado nas migrations `0021`/`0022` (`__new_checklist_items` → copiar → dropar → renomear). A FK usa `ON DELETE NO ACTION` (e não `SET NULL`, incompatível com `tenant_id NOT NULL` em FK composta); a remoção de vínculo é feita pela API e a integridade é auditada por check dedicado.

Alternativa considerada: guardar tudo em uma coluna JSON — rejeitada por perder índices/validação e dificultar consultas de integridade.

### 3. Semântica do gate: modo simples omite e rejeita escrita, sem apagar

Com `advancedChecklists = false`, a API devolve itens apenas como `{ id, text, checked, position }` e rejeita `dueDate`, `assigneeId` ou `description` com erro de validação não retentável. Com `true`, aceita e devolve os campos. Desligar o gate **não** limpa colunas: os valores permanecem no banco e voltam a aparecer na reativação. Isso atende "o default é checklist simples" sem transformar a opção em operação destrutiva.

Alternativa considerada: aceitar e ignorar campos quando desligado — rejeitada por mascarar erro do cliente e permitir gravação fora do modo vigente.

### 4. Contrato `ChecklistItem` retrocompatível

Estender `ChecklistItem` com `dueDate`, `assigneeId` e `assignee` (`{ id, name, avatarUrl } | null`) e `description`, todos opcionais/anuláveis. Clientes antigos que só leem `text`/`checked` continuam funcionando; o ganho de payload no modo detalhado fica restrito ao detalhe do card (o board segue com apenas `checklistProgress`).

### 5. Descrição em rich text com o `RichTextEditor` existente

Reutilizar `apps/web/src/components/RichTextEditor.tsx` (TipTap, saída HTML, barra de formatação e expansão em modal), já usado na descrição de cards e no escopo do projeto. A edição da descrição do item ocorre em uma modal dedicada, aberta pelo ícone de notas, conforme o card. Evita um segundo editor markdown e mantém consistência visual.

Alternativa considerada: markdown puro em `textarea` — rejeitada por divergir da experiência de edição já existente e exigir um renderer próprio.

### 6. Reutilizar o evento `CHECKLIST_UPDATED`

Alterações de data, responsável e descrição reutilizam `CHECKLIST_UPDATED` (com `itemId`, `checklistId` e `progress`), sem novo tipo de evento. O progresso continua contando apenas `checked`/`total`; os campos avançados não entram no cálculo.

### 7. MCP com schema próprio de alteração de item de checklist

Adicionar `dueDate`, `assigneeId` e `description` como opcionais nas ferramentas de checklist e criar um schema de `changes` específico de item de checklist. Hoje `schemaFor('changes')` reaproveita o enum de campos de item (`apps/mcp/src/registry.ts`), o que impediria alterar só o item de checklist; a mudança corrige essa lacuna e mantém o catálogo (`bun run test:mcp-catalog`) e o README documentados. O gate do projeto é aplicado no servidor; o MCP apenas repassa e traduz o erro.

## Risks / Trade-offs

- **Rebuild de `checklist_items` no SQLite corromper dados** → usar o padrão já validado das migrations `0021`/`0022`, desabilitar FK durante a migração e rodar `PRAGMA foreign_key_check` + `bun run test:migrations`.
- **Responsável deixa o projeto depois** → a validação de membership ocorre na escrita; o valor é preservado e a UI pode sinalizar que o responsável não é mais membro. Não é limpo automaticamente.
- **Payload do detalhe cresce com HTML da descrição** → descrição não é enviada no payload do board (apenas no detalhe); sem impacto no carregamento do Kanban.
- **Gate aplicado de forma inconsistente entre web/API/MCP** → centralizar a decisão na API e cobrir com testes de contrato e de rota; MCP e web nunca decidem sozinhos.
- **Perda de dados ao desligar a opção** → explicitamente não destrutivo, coberto por cenário e teste.
- **Gates de CI (i18n e catálogo MCP)** → rodar `bun run check`, `bun run test:migrations`, `bun run test:mcp-catalog` e `bun run test:smoke` antes de concluir.

## Migration Plan

1. Migration append-only: `ALTER TABLE projects ADD COLUMN advanced_checklists ... DEFAULT false`.
2. Migration de rebuild de `checklist_items` adicionando `due_date`, `assignee_id` (FK `users`, `ON DELETE SET NULL`) e `description`; preservar todos os itens existentes.
3. Atualizar `schema.ts`, guardas de integridade (incluindo check de órfão para o responsável do item) e snapshots do Drizzle.
4. Estender `packages/types`, validações da API, rotas de checklist/projeto e payloads de item/board.
5. Atualizar web (settings + `ChecklistSection` + modal de descrição) e i18n nos 3 idiomas.
6. Atualizar MCP (schema, tools, limites, README).
7. Testes e verificação (`bun run check`, `test:migrations`, `test:mcp-catalog`, `test:smoke`).
8. Rollback: reverter o código; as colunas novas são compatíveis e podem permanecer com `false`/`NULL`, sem perda de dados.

## Open Questions

- O responsável que sai do projeto deve ser sinalizado na UI como "não é mais membro" ou o campo deve ser limpo? Recomendação: manter e sinalizar, evitando perda silenciosa.
- `dueDate` pode ser retroativa? Recomendação: permitir e exibir em destaque quando vencida, sem bloquear a gravação.
- O progresso do checklist deve considerar data vencida? Recomendação: não nesta entrega; progresso continua apenas por `checked`.
