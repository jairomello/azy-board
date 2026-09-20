## Why

Hoje todo item de checklist é simples: apenas texto e marcação de concluído. Quem usa checklists para planejar trabalho real precisa registrar **data prevista de término**, **responsável** e **explicações da tarefa** — mas impor isso a todos os projetos pioraria a experiência de quem quer apenas uma lista rápida. O card T5 pede que esses campos sejam **opcionais por projeto**, com o modo simples como padrão.

## What Changes

- Adicionar, nas configurações do projeto, um toggle **"Checklists detalhados"** (`advancedChecklists`), **desligado por padrão** e restrito a ADMIN.
- **Modo simples (padrão):** o comportamento atual permanece — itens de checklist expõem apenas `{ id, text, checked, position }`, sem data, responsável ou descrição.
- **Modo detalhado (toggle ligado):** cada item de checklist passa a poder ter, de forma **não obrigatória**:
  - `dueDate` (data prevista de término);
  - `assigneeId` (responsável, obrigatoriamente membro do projeto);
  - `description` (descrição em rich text/markdown, editada em uma modal própria com barra de formatação).
- Editar a descrição detalhada ocorre exclusivamente na **modal de descrição** do item, aberta por um ícone de "notas".
- Desligar o toggle **não apaga** os dados: os valores são preservados no banco e voltam a aparecer se o modo detalhado for reativado.
- Com o modo detalhado desligado, a API rejeita escrita de campos avançados (erro claro) e os omite nas respostas.
- Refletir os campos avançados nas ferramentas MCP de checklist (`add_checklist_item`, `add_checklist_item_to_task`, `update_checklist_item`, `list_checklists`), com o mesmo gate do projeto.
- Traduzir os novos textos em pt-BR, en e es.

## Capabilities

### New Capabilities

- `project-checklist-settings`: opção por projeto que habilita os campos avançados de item de checklist, com padrão simples, permissão de ADMIN e aplicação às respostas/escritas da API.

### Modified Capabilities

- `card-checklists`: itens de checklist passam a suportar, sob a opção do projeto, `dueDate`, `assigneeId` (membro do projeto) e `description`, com validação, payloads e evento WebSocket correspondentes.
- `mcp-server`: ferramentas MCP de checklist passam a aceitar e retornar os campos avançados opcionais, respeitando o gate do projeto.

## Impact

- **Contratos:** `packages/types/src/index.ts` (`ChecklistItem`, `Project`/contrato de board com `advancedChecklists`).
- **Banco:** `apps/api/src/db/schema.ts` (coluna `projects.advanced_checklists` e colunas `checklist_items.due_date`, `assignee_id`, `description`) + migrations append-only e guardas de integridade.
- **API:** `apps/api/src/validation.ts` (schemas de checklist e de projeto), `apps/api/src/routes/checklists.ts`, `apps/api/src/routes/projects.ts` e `apps/api/src/routes/items.ts` (payload de detalhe e board).
- **Web:** `apps/web/src/components/ChecklistSection.tsx`, `apps/web/src/components/ItemModal.tsx`, `apps/web/src/components/RichTextEditor.tsx` (modal de descrição), `apps/web/src/features/project-settings/**` (toggle) e `apps/web/src/i18n/locales/{pt-BR,en,es}/{board,settings}.json`.
- **MCP:** `apps/mcp/src/registry.ts`, `apps/mcp/src/tools.ts`, `apps/mcp/src/limits.ts`, `apps/mcp/src/validation.ts`, `apps/mcp/README.md`.
- **Rastreabilidade:** Board ref: `e067830d-e34d-4e18-b119-7941b3df7e40` (card T5).
- **Fora de escopo:** subtarefas a partir de itens de checklist, notificações/lembretes por `dueDate`, campos obrigatórios, faixas de data múltiplas e checklist por template.
