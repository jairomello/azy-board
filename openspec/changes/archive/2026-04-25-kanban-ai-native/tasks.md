## 1. Setup do Monorepo e Dependências Globais

- [x] 1.1 Inicializar monorepo com estrutura `apps/api`, `apps/web`, `apps/mcp`, `packages/types`
- [x] 1.2 Configurar `package.json` raiz com workspaces e scripts de dev/build
- [x] 1.3 Configurar TypeScript compartilhado (`tsconfig.base.json`) para todos os apps
- [x] 1.4 Adicionar dependências do backend: `hono`, `drizzle-orm`, `better-sqlite3`, `bcrypt`, `jose` (JWT)
- [x] 1.5 Adicionar dependências do frontend: `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `tailwindcss`, `@dnd-kit/core`, `@dnd-kit/sortable`
- [x] 1.6 Adicionar dependências de UI: `shadcn/ui` (init), componentes base (Button, Card, Dialog, Badge, Avatar, Progress, Tooltip, Popover)
- [x] 1.7 Adicionar dependências do MCP: `@modelcontextprotocol/sdk`
- [x] 1.8 Configurar Tailwind CSS com `darkMode: 'class'` e PostCSS no frontend
- [x] 1.9 Adicionar dependências de i18n: `i18next`, `react-i18next` (ambos MIT)
- [x] 1.10 Adicionar dependências de rich text: `@tiptap/react`, `@tiptap/starter-kit`, extensões de markdown (MIT)
- [x] 1.11 Adicionar dependência de lightbox: `yet-another-react-lightbox` (MIT)
- [x] 1.12 Criar estrutura de pastas de traduções: `apps/web/src/i18n/locales/{pt-BR,en,es}/{common,board,auth,settings}.json`

## 2. Multi-Tenancy — Fundação

- [x] 2.1 Definir schema Drizzle: tabela `tenants` com campos `id`, `name`, `slug`, `created_at`
- [x] 2.2 Adicionar coluna `tenant_id` (NOT NULL, FK → tenants) em todas as tabelas de negócio: `users`, `projects`, `modules`, `epics`, `stories`, `tasks`, `columns`, `sprints`, `tags`, `attachments`, `api_keys`
- [x] 2.3 Criar índices compostos `(tenant_id, id)` e `(tenant_id, project_id)` nas tabelas de maior volume
- [x] 2.4 Implementar middleware de resolução de tenant: extrair `tenant_id` do JWT (usuários) ou da API Key (agentes) e injetar no contexto da requisição
- [x] 2.5 Criar helper Drizzle `withTenant(tenantId)` que encapsula o filtro `WHERE tenant_id = ?` obrigatório em todas as queries — nenhum handler acessa o banco sem passar pelo helper
- [x] 2.6 Implementar script CLI `bun run setup`: solicita nome do tenant, slug e e-mail do admin; cria tenant + usuário admin no banco; exibe credenciais geradas
- [x] 2.7 Incluir `tenant_id` no payload do JWT no momento do login
- [x] 2.8 Garantir que API Keys armazenam `tenant_id` e que o middleware as resolve corretamente

## 4. Schema do Banco de Dados

- [x] 4.1 Definir schema Drizzle: tabela `users` (com campos `avatar_url`, `theme`, `language`, `tenant_id`), `api_keys`
- [x] 4.2 Definir schema Drizzle: tabelas `projects`, `squads`, `memberships` (todos com `tenant_id`)
- [x] 4.3 Definir schema Drizzle: tabelas `modules`, `columns`, `sprints` (todos com `tenant_id`)
- [x] 4.4 Definir schema Drizzle: tabelas `epics`, `stories` (todos com `tenant_id`)
- [x] 4.5 Definir schema Drizzle: tabela `tasks` com campos `parent_id` (FK self-reference), `ancestry_path` (JSON), `points` (inteiro nullable), `tenant_id`
- [x] 4.6 Definir schema Drizzle: tabela `attachments` com campos `task_id`, `filename`, `mime_type`, `size`, `storage_path`, `url`, `tenant_id`
- [x] 4.7 Definir schema Drizzle: tabelas `tags`, `task_tags` (relação N:N tasks-tags, com `tenant_id` em `tags`)
- [x] 4.8 Definir schema Drizzle: tabela `task_sprint` (relação N:N tasks-sprints)
- [x] 4.9 Criar migration inicial e rodar em SQLite local
- [x] 4.10 Criar script de seed com tenant de exemplo, usuário MVP, projeto, módulos, épicos, stories e tasks em vários níveis

## 5. Backend — Auth

- [x] 3.1 Implementar `POST /auth/login`: validar credenciais hardcoded, emitir JWT em cookie HttpOnly
- [x] 3.2 Implementar middleware de autenticação: validar JWT em todas as rotas protegidas
- [x] 3.3 Implementar middleware de autenticação por API Key: header `Authorization: Bearer`
- [x] 3.4 Implementar middleware RBAC: verificar perfil do usuário no projeto antes de cada operação
- [x] 3.5 Implementar helper anti-IDOR: todas as queries incluem `userId` como filtro obrigatório
- [x] 3.6 Implementar `POST /auth/logout`: invalidar cookie de sessão
- [x] 3.7 Implementar `POST /projects/{id}/api-keys`: gerar API Key vinculada ao usuário autenticado
- [x] 3.8 Implementar `GET /projects/{id}/api-keys`: listar API Keys do usuário (sem revelar valor completo)

## 4. Backend — Projetos, Módulos e Squads

- [x] 4.1 Implementar `POST /projects`: criar projeto, associar criador como ADMIN, criar módulo "Geral" padrão
- [x] 4.2 Implementar `GET /projects`: listar projetos do usuário (filtrado por membership)
- [x] 4.3 Implementar `GET /projects/{id}`: retornar projeto (verifica membership; 404 se não autorizado)
- [x] 4.4 Implementar `PATCH /projects/{id}`: editar nome/descrição (apenas ADMIN)
- [x] 4.5 Implementar `POST /projects/{id}/modules`: criar módulo no projeto
- [x] 4.6 Implementar `GET /projects/{id}/modules`: listar módulos ordenados
- [x] 4.7 Implementar `PATCH /projects/{id}/modules/{moduleId}`: renomear ou reordenar módulo
- [x] 4.8 Implementar `DELETE /projects/{id}/modules/{moduleId}`: excluir módulo movendo epics para módulo destino
- [x] 4.9 Implementar `POST /projects/{id}/squads`: criar squad no projeto
- [x] 4.10 Implementar `POST /projects/{id}/squads/{squadId}/members`: adicionar membro ao squad com perfil
- [x] 4.11 Implementar `PATCH /projects/{id}/members/{userId}`: alterar perfil de membro (apenas ADMIN)

## 5. Backend — Colunas e Sprints

- [x] 5.1 Implementar `GET /projects/{id}/columns`: listar colunas ordenadas
- [x] 5.2 Implementar `POST /projects/{id}/columns`: criar coluna com nome e status base (apenas ADMIN)
- [x] 5.3 Implementar `PATCH /projects/{id}/columns/{colId}`: renomear coluna ou alterar status base
- [x] 5.4 Implementar `PATCH /projects/{id}/columns/reorder`: reordenar colunas
- [x] 5.5 Implementar `DELETE /projects/{id}/columns/{colId}`: excluir coluna movendo cards para coluna destino
- [x] 5.6 Implementar `POST /projects/{id}/sprints`: criar sprint com nome, data início e fim
- [x] 5.7 Implementar `PATCH /projects/{id}/sprints/{sprintId}/activate`: ativar sprint (desativa anterior)
- [x] 5.8 Implementar `PATCH /projects/{id}/sprints/{sprintId}/close`: encerrar sprint ativa
- [x] 5.9 Implementar `GET /projects/{id}/current-sprint`: retornar sprint ativa (endpoint AI-friendly)

## 6. Backend — Épicos, Histórias e Tags

- [x] 6.1 Implementar `POST /projects/{id}/epics`: criar épico vinculado a módulo
- [x] 6.2 Implementar `GET /projects/{id}/epics`: listar épicos (filtráveis por módulo)
- [x] 6.3 Implementar `PATCH /projects/{id}/epics/{epicId}`: editar épico; atualizar ancestry_path das tasks descendentes em cascata
- [x] 6.4 Implementar `POST /projects/{id}/stories`: criar história vinculada a épico
- [x] 6.5 Implementar `GET /projects/{id}/stories`: listar histórias (filtráveis por épico)
- [x] 6.6 Implementar `POST /projects/{id}/tags`: criar tag com nome e cor
- [x] 6.7 Implementar `GET /projects/{id}/tags`: listar tags do projeto
- [x] 6.8 Implementar `PATCH /projects/{id}/tags/{tagId}`: renomear ou mudar cor da tag
- [x] 6.9 Implementar `DELETE /projects/{id}/tags/{tagId}`: excluir tag e desassociar de todos os cards

## 7. Backend — Tasks e Hierarquia

- [x] 7.1 Implementar `POST /projects/{id}/tasks`: criar task; calcular e armazenar `ancestry_path`; aceitar `parent_id` opcional
- [x] 7.2 Implementar `GET /projects/{id}/tasks`: listar tasks com filtros (sprint, módulo, épico, responsável, tags, somente-folhas)
- [x] 7.3 Implementar lógica de Leaf Rule: query helper que determina se task é folha (`children_count = 0`)
- [x] 7.4 Implementar cálculo de progresso: função que percorre tasks folha descendentes e calcula percentual concluído para task pai
- [x] 7.5 Implementar `PATCH /projects/{id}/tasks/{taskId}`: editar campos; atualizar `ancestry_path` de subtasks em cascata se story/épico mudou
- [x] 7.6 Implementar `PATCH /projects/{id}/tasks/{taskId}/move`: mover task folha para coluna, atualizar status base; bloquear move em tasks pai
- [x] 7.7 Implementar `PATCH /projects/{id}/tasks/{taskId}/claim`: fazer claim (verificar se é folha e não está atribuída)
- [x] 7.8 Implementar `PATCH /projects/{id}/tasks/{taskId}/release`: liberar claim
- [x] 7.9 Implementar `DELETE /projects/{id}/tasks/{taskId}`: excluir task; se task pai perde todos os filhos, reativar pai como folha
- [x] 7.10 Implementar `POST /projects/{id}/tasks/{taskId}/tags`: associar tags a task
- [x] 7.11 Implementar `POST /projects/{id}/tasks/{taskId}/sprint`: associar task a sprint

## 8. Backend — Tree View

- [x] 8.1 Implementar `GET /projects/{id}/tree`: query com CTE recursivo retornando toda a árvore do projeto (depth, parent_id, tipo de nó, status, responsável, datas, progresso)
- [x] 8.2 Validar que CTE recursivo funciona corretamente no SQLite 3.35+ e PostgreSQL

## 9. Backend — Shadow Markdown

- [x] 9.1 Implementar `GET /projects/{id}/board.md`: serializar board em Markdown incluindo breadcrumb, status, responsável, prioridade e tags de cada card
- [x] 9.2 Implementar parser de Markdown para diff: comparar estado recebido com estado atual do banco
- [x] 9.3 Implementar `PATCH /projects/{id}/board.md`: processar diff, executar moves/assigns, retornar 422 com lista de inconsistências

## 10. Backend — WebSocket e Realtime

- [x] 10.1 Configurar WebSocket server nativo no Bun (`Bun.serve` com handler `websocket`)
- [x] 10.2 Implementar gerenciador de rooms por projeto (mapa conexões → projectId)
- [x] 10.3 Implementar broadcast de eventos tipados: `CARD_MOVED`, `CARD_CREATED`, `CARD_UPDATED`, `CARD_DELETED`, `TASK_CLAIMED`, `SPRINT_CHANGED`, `SUBTASK_CREATED`, `PROGRESS_UPDATED`
- [x] 10.4 Integrar broadcast nos handlers de API (toda mutação dispara evento WebSocket)
- [x] 10.5 Implementar isolamento por projeto: broadcast só para conexões do mesmo projeto

## 11. Servidor MCP

- [x] 11.1 Configurar servidor MCP com `@modelcontextprotocol/sdk` e transporte stdio
- [x] 11.2 Implementar ferramenta `list_tasks` (parâmetros: `projectId`, `sprintId?`, `onlyLeaves?`)
- [x] 11.3 Implementar ferramenta `get_current_sprint` (parâmetro: `projectId`)
- [x] 11.4 Implementar ferramenta `claim_task` (parâmetros: `projectId`, `taskId`)
- [x] 11.5 Implementar ferramenta `move_task` (parâmetros: `projectId`, `taskId`, `columnName`)
- [x] 11.6 Implementar ferramenta `complete_task` (parâmetros: `projectId`, `taskId`)
- [x] 11.7 Implementar ferramenta `create_task` (parâmetros: `projectId`, `title`, `description?`, `priority?`, `parentId?`, `epicId?`, `tags?`)
- [x] 11.8 Configurar autenticação por variável de ambiente `EASYBOARD_API_KEY`
- [x] 11.9 Documentar configuração do MCP em `apps/mcp/README.md`

## 12. Frontend — Estrutura Base

- [x] 12.1 Configurar Vite + React 18 + TypeScript
- [x] 12.2 Configurar React Router v6 com rotas protegidas (redirect para `/login` se não autenticado)
- [x] 12.3 Criar layout base com sidebar de projetos, seletor de módulo e header do projeto
- [x] 12.4 Implementar contexto de autenticação (AuthContext) com estado do usuário logado
- [x] 12.5 Configurar cliente HTTP (fetch wrapper) com envio automático de cookie e interceptor de 401

## 13. Frontend — Auth

- [x] 13.1 Criar página `/login` com formulário de e-mail e senha
- [x] 13.2 Integrar formulário com `POST /auth/login`
- [x] 13.3 Implementar redirect pós-login para última rota acessada
- [x] 13.4 Implementar logout com chamada a `POST /auth/logout` e limpeza de contexto

## 14. Frontend — Projetos e Configurações

- [x] 14.1 Criar página `/projects` listando projetos do usuário
- [x] 14.2 Criar modal de criação de projeto
- [x] 14.3 Criar página `/projects/{id}/settings` para gerenciar colunas, módulos, squads, tags e membros
- [x] 14.4 Implementar UI de gerenciamento de colunas (criar, renomear, status base, reordenar, excluir)
- [x] 14.5 Implementar UI de gerenciamento de módulos (criar, renomear, reordenar, excluir)
- [x] 14.6 Implementar UI de gerenciamento de tags do projeto (criar, cor, renomear, excluir)

## 15. Frontend — Board Kanban

- [x] 15.1 Criar página `/projects/{id}/board` com layout de colunas kanban
- [x] 15.2 Implementar swimlanes colapsáveis por épico (accordion com progresso no header)
- [x] 15.3 Implementar raia "Tasks Órfãs" para cards sem épico
- [x] 15.4 Implementar drag-and-drop de cards entre colunas usando `@dnd-kit/core` (apenas tasks folha)
- [x] 15.5 Implementar drag-and-drop de reordenação dentro da mesma coluna
- [x] 15.6 Bloquear drag em tasks pai com tooltip explicativo
- [x] 15.7 Implementar toolbar do board: filtro de módulo, sprint, responsável, tags; toggle de subtasks; seletor Kanban/Tree View

## 16. Frontend — Cards

- [x] 16.1 Criar componente de card com: título, breadcrumb (truncado + hover), responsável (avatar + badge IA), prioridade, chips de tags, indicador de status
- [x] 16.2 Criar modal de criação de card com todos os campos (título, descrição, prioridade, responsável, story pai, tags)
- [x] 16.3 Criar modal de detalhe/edição de card completo
- [x] 16.4 Implementar ação de claim/release de card na UI
- [x] 16.5 Implementar indicador visual de card bloqueado e cancelado
- [x] 16.6 Implementar badge de agente de IA no card (ícone de robô + nome do modelo)
- [x] 16.7 Implementar popover de breadcrumb expandido com links navegáveis para cada ancestral

## 17. Frontend — Tree View

- [x] 17.1 Criar componente de Tree View como tabela hierárquica expansível
- [x] 17.2 Implementar nós expansíveis/colapsáveis para cada nível da hierarquia (módulo → épico → story → task → subtask)
- [x] 17.3 Implementar colunas: Nome, Status, Responsável, Data Início, Data Fim, Progresso (barra visual)
- [x] 17.4 Implementar edição inline de título e responsável na Tree View
- [x] 17.5 Implementar botões "Expandir tudo" e "Colapsar tudo" no toolbar
- [x] 17.6 Aplicar filtros do board na Tree View (módulo, sprint, responsável, tags)

## 18. Frontend — Realtime

- [x] 18.1 Implementar cliente WebSocket com reconexão automática e backoff exponencial
- [x] 18.2 Integrar eventos WebSocket no board: `CARD_MOVED`, `CARD_CREATED`, `CARD_UPDATED`, `CARD_DELETED`
- [x] 18.3 Integrar evento `TASK_CLAIMED` para atualizar responsável e badge em tempo real
- [x] 18.4 Integrar evento `SUBTASK_CREATED` para adicionar novos cards ao board em tempo real
- [x] 18.5 Integrar evento `PROGRESS_UPDATED` para atualizar progresso nas swimlanes em tempo real
- [x] 18.6 Integrar evento `SPRINT_CHANGED` para atualizar filtro de sprint em tempo real

## 19. Frontend — Sprints e Épicos

- [x] 19.1 Criar modal de gerenciamento de sprints (criar, ativar, encerrar)
- [x] 19.2 Criar UI de gerenciamento de épicos e stories (criar, vincular a módulo/épico)
- [x] 19.3 Implementar campo de subtask no modal de edição de task (criar subtask filha diretamente do card pai)

## 20. Tema, i18n, Avatares e Anexos

- [x] 20.1 Implementar toggle de tema claro/escuro: classe `dark` no `<html>`, salvar em localStorage e banco
- [x] 20.2 Detectar preferência do SO via `prefers-color-scheme` no primeiro acesso
- [x] 20.3 Configurar i18next com namespaces e arquivos de tradução PT-BR, EN e ES
- [x] 20.4 Implementar seletor de idioma na UI; salvar preferência no banco
- [x] 20.5 Internacionalizar todas as strings da UI (auth, board, settings, modais)
- [x] 20.6 Implementar endpoint `POST /users/me/avatar`: receber imagem, redimensionar para 256x256, salvar no storage
- [x] 20.7 Implementar geração de avatar por iniciais quando usuário sem foto
- [x] 20.8 Exibir avatar (foto ou iniciais) nos cards, Tree View, header e listas de membros
- [x] 20.9 Implementar `POST /projects/{id}/tasks/{taskId}/attachments`: upload multipart, salvar no filesystem local, registrar no banco
- [x] 20.10 Implementar `GET /projects/{id}/tasks/{taskId}/attachments`: listar anexos com URL de acesso
- [x] 20.11 Implementar `DELETE /projects/{id}/tasks/{taskId}/attachments/{attachmentId}`: remover arquivo do storage e do banco
- [x] 20.12 Implementar rota de acesso a arquivos com verificação de membership (anti-IDOR em arquivos)
- [x] 20.13 Implementar interface `StorageAdapter` com implementação de filesystem local e stub para S3
- [x] 20.14 Exibir lista de anexos no modal do card com ícone de tipo, nome, tamanho e botão de download
- [x] 20.15 Integrar lightbox para visualização de imagens inline nos cards
- [x] 20.16 Implementar editor Tiptap na descrição de Stories com toolbar de formatação
- [x] 20.17 Implementar renderização de markdown como HTML formatado na visualização das Stories

## 21. Testes e Validação

- [x] 21.1 Testar fluxo completo de autenticação (login, acesso protegido, logout, token expirado)
- [x] 21.2 Testar proteção anti-IDOR: recursos de projeto sem membership via API e arquivos
- [x] 21.3 Testar RBAC: operações de ADMIN bloqueadas para MEMBER e VIEWER
- [x] 21.4 Testar Leaf Rule: criar subtask em task folha e verificar que task pai sai do Kanban
- [x] 21.5 Testar progresso calculado: concluir subtasks e verificar atualização em cascata nos pais
- [x] 21.6 Testar pontuação: atribuir pontos a tasks folha e verificar soma nos ancestrais em cascata
- [x] 21.7 Testar breadcrumb: renomear ancestral e verificar atualização em todas as tasks descendentes
- [x] 21.8 Testar Shadow Markdown: GET retorna markdown correto com pontos/tags; PATCH move cards no banco
- [x] 21.9 Testar servidor MCP: configurar em Claude Code local e executar todas as ferramentas
- [x] 21.10 Testar realtime: dois browsers no mesmo board, mover card em um e verificar no outro
- [x] 21.11 Testar Tree View: expandir/colapsar; progresso e pontos calculados; edição inline
- [x] 21.12 Testar filtros combinados: módulo + responsável + tag no board e na Tree View
- [x] 21.13 Testar tags: criar, renomear, excluir e filtrar
- [x] 21.14 Testar tema: alternar claro/escuro, persistência em localStorage e banco, detecção do SO
- [x] 21.15 Testar i18n: trocar idioma, verificar todas as strings, fallback para PT-BR
- [x] 21.16 Testar upload e visualização de anexos: upload, listagem, lightbox de imagens, exclusão
- [x] 21.17 Testar avatar: upload de foto, fallback por iniciais, exibição nos cards
