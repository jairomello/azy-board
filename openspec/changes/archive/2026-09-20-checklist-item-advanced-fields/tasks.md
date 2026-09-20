## 1. Banco de dados e integridade

- [x] 1.1 Registrar o `Board ref: e067830d-e34d-4e18-b119-7941b3df7e40` (card T5) no acompanhamento da change
- [x] 1.2 Adicionar `advancedChecklists` (coluna `advanced_checklists`, booleano, `NOT NULL DEFAULT false`) ao schema `projects` em `apps/api/src/db/schema.ts`
- [x] 1.3 Adicionar `dueDate` (`due_date`), `assigneeId` (`assignee_id`) e `description` a `checklistItems`, com FK composta `assignee_id → users(tenant_id, id)`
- [x] 1.4 Gerar as migrations append-only (`bun run db:generate`), garantindo que o rebuild de `checklist_items` preserve os itens existentes
- [x] 1.5 Adicionar guardas de integridade em `apps/api/src/db/integrity.ts` para responsável de item de checklist fora do projeto/tenant
- [x] 1.6 Rodar `bun run test:migrations` e confirmar `PRAGMA foreign_key_check` sem violações

## 2. Contratos compartilhados

- [x] 2.1 Estender `ChecklistItem` em `packages/types/src/index.ts` com `dueDate`, `assigneeId`, `assignee` e `description` (opcionais/anuláveis)
- [x] 2.2 Expor `advancedChecklists` no contrato de projeto/board usado pela web

## 3. API

- [x] 3.1 Estender `checklistItemSchema` e `updateChecklistItemSchema` em `apps/api/src/validation.ts` com `dueDate`, `assigneeId` e `description` opcionais e `description` limitada a 20000 caracteres
- [x] 3.2 Adicionar `advancedChecklists` opcional a `createProjectSchema`/`updateProjectSchema` (booleano estrito)
- [x] 3.3 Em `PATCH /projects/:id`, persistir a opção apenas para ADMIN e devolvê-la nas respostas de `GET /projects/:id` e `GET /projects/:id/board`
- [x] 3.4 Em `apps/api/src/routes/checklists.ts`, aplicar o gate: rejeitar campos avançados quando `advancedChecklists = false` e omiti-los nas respostas do modo simples
- [x] 3.5 Validar que `assigneeId` é membro do projeto e do tenant antes de gravar, retornando erro de validação sem expor dados de outro tenant
- [x] 3.6 Incluir os campos avançados e o `assignee` resolvido no detalhe do card (`items.ts`) quando a opção estiver ligada
- [x] 3.7 Manter `CHECKLIST_UPDATED` como evento para mutações de data, responsável e descrição, preservando o cálculo de `checklistProgress`
- [x] 3.8 Garantir `// [TENANT]` nos novos pontos de resolução de tenant e `// [DB-SWAP]` onde a migração SQLite → PostgreSQL exigir troca

## 4. Web — configurações do projeto

- [x] 4.1 Adicionar `advancedChecklists` ao modelo e ao carregamento de `apps/web/src/features/project-settings/**`
- [x] 4.2 Criar a seção de configuração com o controle "Checklists detalhados" (desligado por padrão, texto de apoio, acessível por teclado)
- [x] 4.3 Ligar o controle ao `PATCH /projects/:id`, preservando o valor anterior em caso de erro

## 5. Web — checklist detalhado no card

- [x] 5.1 Passar `advancedChecklists` e os membros do projeto ao `ChecklistSection` pelo `ItemModal`
- [x] 5.2 Renderizar, no modo detalhado, data prevista (`input` de data com limpar), responsável (select de membros) e ícone de notas com indicador quando houver descrição
- [x] 5.3 Criar a modal de descrição do item reutilizando `RichTextEditor` (barra de formatação) e salvar via `PATCH .../items/:checklistItemId`
- [x] 5.4 Manter o modo simples idêntico ao atual (texto + checkbox + excluir), sem consultar os novos campos
- [x] 5.5 Tratar carregamento e erro das mutações sem quebrar a lista nem o progresso do checklist

## 6. MCP

- [x] 6.1 Adicionar `dueDate`, `assigneeId` e `description` como opcionais nas ferramentas `add_checklist_item`, `add_checklist_item_to_task` e `list_checklists`
- [x] 6.2 Criar schema de `changes` próprio de item de checklist para `update_checklist_item` (em vez do schema genérico de item)
- [x] 6.3 Atualizar `limits.ts` com o limite de `description` e `validation.ts`/`tools.ts` para repassar os campos
- [x] 6.4 Atualizar descrições e o `apps/mcp/README.md` para documentar os campos e o gate do projeto
- [x] 6.5 Rodar `bun run test:mcp-catalog` e `bun run test:agent-skill`

## 7. i18n

- [x] 7.1 Adicionar as chaves da seção de configuração em `apps/web/src/i18n/locales/{pt-BR,en,es}/settings.json`
- [x] 7.2 Adicionar as chaves do checklist detalhado (data, responsável, notas, modal) em `apps/web/src/i18n/locales/{pt-BR,en,es}/board.json`
- [x] 7.3 Rodar `bun run check:i18n` e garantir paridade das três locales

## 8. Testes e verificação

- [x] 8.1 Testes de rota em `apps/api`: default `false`, gate ligado/desligado, rejeição e omissão de campos, validação de responsável membro do projeto
- [x] 8.2 Testes de migração e integridade para as novas colunas (preservação de dados no rebuild e check de órfão)
- [x] 8.3 Testes de contrato do web para o toggle de settings e para os controles do `ChecklistSection` no modo detalhado
- [x] 8.4 Testes MCP de schema/limites das ferramentas de checklist
- [x] 8.5 Rodar `bun run check` (typecheck + lint + testes + build) e `bun run test:smoke`
- [x] 8.6 Validar os cenários por testes de integração/contrato (modo simples inalterado; modo detalhado com data, responsável e descrição; desligar preserva dados; reativar restaura) — sem sessão de navegador nesta execução
- [x] 8.7 Rodar `openspec validate checklist-item-advanced-fields` e confirmar o fechamento do card T5 no board (`complete_task` + conferência via `get_board`/`list_tasks`)
