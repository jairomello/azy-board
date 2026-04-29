## 1. Banco de dados — Migrations

- [x] 1.1 Criar migration: adicionar coluna `author_id UUID REFERENCES users(id)` (nullable) em `tasks`
- [x] 1.2 Criar migration: criar tabela `task_logs` com campos `id`, `tenant_id`, `task_id`, `author_id`, `type` (enum auto/manual), `activity`, `duration_min`, `created_at`, `updated_at` — incluir índices em `(task_id, created_at)` e `(tenant_id)` // [TENANT] tenant_id obrigatório // [DB-SWAP] enum type precisa virar TEXT CHECK em SQLite
- [x] 1.3 Atualizar schema Drizzle ORM com os novos campos e tabela
- [x] 1.4 Rodar migrations e validar em ambiente local

## 2. Backend — Campo autor nas tasks

- [x] 2.1 Atualizar handler `POST /projects/:id/tasks` para extrair `author_id` do contexto de autenticação (JWT userId ou agentId) e persistir na task // [TENANT] verificar que tenant_id vem do middleware
- [x] 2.2 Atualizar handler `PATCH /projects/:id/tasks/:taskId` para ignorar silenciosamente `author_id` no body (não permitir sobrescrita)
- [x] 2.3 Incluir campo `author` (objeto com `id`, `name`, `avatarUrl`) no retorno dos endpoints `GET /tasks` e `GET /tasks/:id` via join com `users`

## 3. Backend — API de filhos diretos

- [x] 3.1 Criar endpoint `GET /projects/:projectId/tasks/:taskId/children` que retorna tasks com `parent_id === taskId` e `tenant_id` correto // [TENANT] filtrar por tenant_id do middleware
- [x] 3.2 Aplicar RBAC (VIEWER ou superior) e anti-IDOR (verificar membership do projeto) no endpoint de filhos
- [x] 3.3 Incluir campos mínimos para renderização do mini-card: título, tipo, prioridade, responsável (avatar), status/coluna

## 4. Backend — API de logs de atividade

- [x] 4.1 Criar endpoint `GET /projects/:projectId/tasks/:taskId/logs?page&limit` com paginação (20/página padrão), filtro por `tenant_id` // [TENANT]
- [x] 4.2 Criar endpoint `POST /projects/:projectId/tasks/:taskId/logs` que cria log manual com `type = 'manual'`, `author_id` do usuário autenticado, `activity` e `duration_min` opcional; bloquear VIEWER (403)
- [x] 4.3 Criar endpoint `PATCH /projects/:projectId/tasks/:taskId/logs/:logId` que: (a) rejeita com 403 se `type = 'auto'`; (b) rejeita com 403 se `author_id !== userId` e papel não é ADMIN; (c) atualiza `activity` e `duration_min`
- [x] 4.4 Criar função de serviço `createAutoLog(taskId, tenantId, authorId, activity)` reutilizável nos handlers de update e move

## 5. Backend — Triggers de log automático

- [x] 5.1 Instrumentar handler `PATCH /tasks/:taskId` para chamar `createAutoLog` quando campos relevantes (título, descrição, prioridade, responsável, tags, pontos, datas) mudarem; comparar estado anterior vs novo para gerar texto descritivo
- [x] 5.2 Instrumentar endpoint/lógica de movimentação de coluna (drag-and-drop ou atualização de status) para chamar `createAutoLog` com texto "Movido de '[Coluna Origem]' para '[Coluna Destino]'"
- [x] 5.3 Garantir que PATCH sem alteração real (payload igual ao estado atual) não gere log

## 6. Frontend — Hook useModalStack

- [x] 6.1 Criar hook `useModalStack` que gerencia array de `taskId[]` com operações `push(taskId)`, `pop()` e `closeAll()`
- [x] 6.2 Garantir que `closeAll()` limpa toda a pilha e que Escape na modal do topo executa `pop()` (não `closeAll()`)
- [x] 6.3 Implementar limite de 5 níveis: ao ultrapassar, substituir o topo em vez de empilhar

## 7. Frontend — Seção de filhos na CardModal

- [x] 7.1 Criar componente `CardChildrenSection` que recebe `taskId` e renderiza filhos em grid de 2 colunas (1 em mobile) usando dados de `GET .../children`
- [x] 7.2 Cada mini-card filho exibe: título, ícone de tipo, badge de prioridade, avatar do responsável, badge de status
- [x] 7.3 Ao clicar em um filho, chamar `useModalStack.push(filhoId)` para abrir modal empilhada
- [x] 7.4 Exibir mensagem "Nenhuma subtask criada" quando lista retornar vazia
- [x] 7.5 Integrar `CardChildrenSection` no rodapé da `CardModal`, após o botão "Histórico"

## 8. Frontend — Navegação por stack de modais

- [x] 8.1 Atualizar `CardModal` para aceitar contexto de `useModalStack`; renderizar botão "← Voltar" no header quando a modal for filha (stack.length > 1)
- [x] 8.2 Botão "✕ Fechar" na modal filha deve chamar `closeAll()`, não apenas `pop()`
- [x] 8.3 Modais empilhadas devem ter `z-index` incremental e overlay de fundo adicional para separação visual

## 9. Frontend — Campo Autor na CardModal

- [x] 9.1 Adicionar campo "Autor" somente leitura na `CardModal`, próximo ao campo "Responsável", exibindo avatar + nome ou "—" se null
- [x] 9.2 Garantir que o campo autor seja populado pelos dados retornados no GET da task (campo `author`)

## 10. Frontend — Botão Histórico e soma de horas

- [x] 10.1 Adicionar botão "Histórico" (ícone de relógio + label) no rodapé da `CardModal`, acima de `CardChildrenSection`
- [x] 10.2 Calcular soma de `duration_min` dos logs manuais e exibir "Xh Ym trabalhadas" ao lado do botão quando soma > 0
- [x] 10.3 Ao clicar em "Histórico", abrir `ActivityLogModal` sobre a `CardModal` (empilhada com z-index superior)

## 11. Frontend — ActivityLogModal

- [x] 11.1 Criar componente `ActivityLogModal` que recebe `taskId` e exibe: título e ID da task no header, lista paginada de logs, botão "+ Registrar"
- [x] 11.2 Cada entrada de log exibe: ícone 🤖 (auto) ou ✏️ (manual), avatar + nome do autor, data/hora formatados, descrição da atividade, duração (se existir)
- [x] 11.3 Ícone de lápis (editar) visível apenas em logs `manual` onde `author_id === userId logado` OU usuário é ADMIN
- [x] 11.4 Formulário "+ Registrar": campos `activity` (textarea obrigatório) e `duration_min` (input numérico opcional em minutos); ao salvar, chama `POST .../logs` e atualiza lista
- [x] 11.5 Formulário de edição inline ao clicar no lápis: mesmos campos preenchidos; ao salvar chama `PATCH .../logs/:logId`; ao cancelar restaura estado anterior
- [x] 11.6 Botão "Carregar mais" ao final da lista quando `total > 20`
- [x] 11.7 Fechar `ActivityLogModal` com "✕" ou Escape retorna foco para `CardModal` pai sem recarregar dados do card

## 12. Internacionalização (i18n)

- [x] 12.1 Adicionar chaves PT-BR para todos os novos textos: "Autor", "Histórico", "Subtasks", "Nenhuma subtask criada", "Xh Ym trabalhadas", "Registrar atividade", "Atividade", "Duração (min)", "+ Registrar", "Carregar mais", "← Voltar", rótulos de log auto/manual
- [x] 12.2 Adicionar equivalentes em EN e ES para as mesmas chaves
