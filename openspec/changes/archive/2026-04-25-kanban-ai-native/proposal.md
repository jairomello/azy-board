## Why

Equipes modernas combinam humanos e agentes de IA trabalhando em paralelo nas mesmas listas de tarefas, mas as ferramentas existentes (Jira, Linear, Trello) foram criadas antes da era de agentes autônomos: são caras, pesadas e não oferecem interfaces simples o suficiente para que uma IA consuma e atualize tarefas com a mesma facilidade que lê um arquivo `.md` local. Ao mesmo tempo, arquivos `.md` gerados localmente não oferecem visibilidade compartilhada para o time, causando colisões quando humanos e IAs trabalham em paralelo no mesmo projeto.

A maioria das ferramentas foi feita para humanos **reportarem** trabalho. O **Azy Board** foi feito para que o trabalho **aconteça** dentro da ferramenta — onde agentes de IA e humanos colaboram no mesmo board com a mesma naturalidade.

## What Changes

- Criação do **Azy Board**: Kanban board multi-projeto, AI-native, com UI sofisticada e drag-and-drop
- Hierarquia completa de organização: **Project → Module → Epic → Story → Task (↺ subtasks por autorrelacionamento)**
- **Leaf Rule**: apenas Tasks sem filhos (tasks folha) são movidas nas colunas do Kanban; tasks pai tornam-se agregadoras de progresso calculado automaticamente
- **Breadcrumb dinâmico** nos cards: exibe o caminho hierárquico completo (`Projeto > Módulo > Épico > Task Pai > ... > Task Atual`), truncado com hover/click para expandir a árvore de ancestrais
- **Colunas customizáveis** com mapeamento de status base; múltiplas colunas podem mapear para o mesmo status
- **Sprints**: cadastro, sprint ativa e filtragem do board por sprint
- **Filtros do board**: por módulo, sprint, membro responsável; toggle para exibir ou ocultar subtasks
- **Tree View**: visão alternativa ao Kanban em formato de tabela hierárquica expansível (Project → Module → Epic → Story → Task → Subtasks) com colunas de status, responsável, datas e progresso %
- **Tags dinâmicas**: tags criadas no nível do projeto, múltiplas por card, usáveis como filtros no board
- **Identidade de agentes IA**: API Key vinculada a um humano Owner; cards exibem avatar do humano + badge do modelo de IA
- **Shadow Markdown**: `GET /projects/{id}/board.md` + `PATCH` para leitura/escrita do board por LLMs
- **Servidor MCP** nativo com ferramentas de board para agentes de IA
- **Arquitetura multi-tenant**: isolamento completo de dados por tenant (cliente) via `tenant_id` em todas as tabelas; tenant resolvido no middleware a partir do JWT ou API Key; criação de tenants exclusivamente via script CLI de setup — sem UI, sem rotas de API expostas; base preparada para crescer para SaaS sem reescrever lógica de negócio
- **Tema claro/escuro**: toggle de tema com preferência persistida; todos os componentes suportam ambos os modos
- **Internacionalização**: suporte a PT-BR, EN e ES com arquitetura expansível para novos idiomas
- **Fotos e avatares de usuário**: upload de foto de perfil ou geração de avatar por iniciais; exibido nos cards e no breadcrumb
- **Rich text nas Stories**: descrição com formatação visual (negrito, listas, links, código, cabeçalhos) armazenada como markdown
- **Anexos em cards**: upload de arquivos em qualquer card; imagens visualizadas diretamente no sistema via lightbox
- **Pontuação de tasks**: campo numérico de pontos por task folha; pontos somados automaticamente nos pais (story, épico, módulo)
- **Segurança by design**: autenticação obrigatória, RBAC server-side, anti-IDOR em todas as rotas
- **Realtime**: WebSocket nativo (Bun) para sincronização instantânea

## Capabilities

### New Capabilities

- `project-management`: Criação de projetos, múltiplos squads por projeto, membros com perfis e permissões
- `module-management`: Criação e gerenciamento de módulos dentro de um projeto; módulo é o segundo nível da hierarquia e filtro principal do board
- `board-management`: Colunas customizáveis com mapeamento coluna → status base; reordenação por drag-and-drop; filtros por módulo, sprint e responsável; toggle de subtasks
- `sprint-management`: CRUD de sprints, sprint ativa, filtragem do board; endpoint `current_sprint` para agentes de IA
- `epic-tracking`: Épico como swimlane/raia no board; swimlanes colapsáveis; raia "Tasks Órfãs" para tasks sem épico
- `task-hierarchy`: Autorrelacionamento de tasks via `parent_id`; Leaf Rule (só tasks folha são movidas no Kanban); progresso calculado em tasks pai; breadcrumb dinâmico nos cards
- `card-management`: CRUD completo de cards com título, descrição, labels, prioridade, responsável, épico pai, tags e breadcrumb; sistema de claim para evitar colisões
- `tree-view`: Visão alternativa em tabela hierárquica expansível de todo o projeto com status, responsável, datas e progresso %
- `tag-management`: Tags dinâmicas no nível do projeto, múltiplas por card, usáveis como filtros no board
- `multi-tenancy`: Isolamento de dados por tenant via shared schema com `tenant_id`; resolução no middleware; setup via script CLI; sem UI de gerenciamento no MVP
- `theming`: Toggle de tema claro/escuro; preferência persistida por usuário
- `i18n`: Internacionalização PT-BR / EN / ES com arquitetura expansível; idioma persistido por usuário
- `file-attachments`: Upload de anexos em qualquer card; visualização de imagens inline via lightbox; armazenamento local no MVP com abstração para cloud
- `ai-api`: REST AI-friendly + Shadow Markdown (`GET/PATCH /projects/{id}/board.md`)
- `mcp-server`: Servidor MCP nativo com ferramentas de board para agentes de IA
- `realtime-sync`: WebSocket para sincronização em tempo real do estado do board
- `auth`: Login por e-mail/senha; RBAC server-side; anti-IDOR; API Key vinculada a Owner humano para agentes de IA; foto de perfil ou avatar por iniciais

### Modified Capabilities

## Impact

- Projeto greenfield — nenhum código existente afetado
- **Stack** (todas as licenças MIT / Apache 2.0 / Public Domain):
  - Frontend: React 18 + Vite + TypeScript, shadcn/ui, Tailwind CSS, dnd-kit
  - Backend: Bun + Hono
  - ORM: Drizzle ORM (SQLite local → PostgreSQL em produção, apenas troca o driver)
  - Realtime: WebSocket nativo do Bun
  - MCP: `@modelcontextprotocol/sdk` (MIT)
- Credenciais de desenvolvimento: `admin@example.com` / `change-me-admin-password` (seed local; substituído por auth completo em iteração futura)
- Deploy futuro: qualquer VPS/cloud + PostgreSQL gerenciado
