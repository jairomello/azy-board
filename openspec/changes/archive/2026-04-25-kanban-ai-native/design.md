## Context

Projeto greenfield. O Azy Board é um Kanban board AI-native para equipes mistas (humanos + agentes de IA), com hierarquia `Project → Module → Epic → Story → Task (↺ subtasks)`, sprints, swimlanes, tree view e uma API projetada para ser consumida por LLMs tão facilmente quanto um arquivo `.md`.

Stakeholders: times de desenvolvimento que usam agentes de IA (Claude Code, Codex, etc.) e precisam de visibilidade compartilhada do progresso.

## Goals / Non-Goals

**Goals:**
- UI sofisticada com drag-and-drop, swimlanes colapsáveis, breadcrumb dinâmico e tree view
- Leaf Rule: apenas tasks folha aparecem no Kanban como cards móveis
- Progresso calculado automaticamente em tasks pai com base nas tasks folha
- API REST AI-friendly + Shadow Markdown para consumo por LLMs
- Servidor MCP nativo para integração direta com agentes de IA
- Tags dinâmicas por projeto como filtros no board
- Segurança server-side: RBAC + anti-IDOR em todas as rotas
- SQLite local para desenvolvimento; troca para PostgreSQL em produção sem alterar código de aplicação
- Realtime via WebSocket para todos os participantes

**Non-Goals:**
- Auth completo (OAuth, convite por e-mail, recuperação de senha) — iteração futura
- Integrações com ferramentas externas (GitHub, Slack, etc.) — fora do escopo inicial
- Mobile app nativo
- Relatórios e dashboards de métricas avançados

## Decisions

### D1 — Monorepo com dois processos separados (frontend + backend)

**Escolha:** Um único repositório com `apps/web` (React + Vite) e `apps/api` (Bun + Hono), compartilhando tipos TypeScript via `packages/types`.

**Alternativa considerada:** Next.js full-stack (App Router + API Routes). Descartado porque o backend precisa rodar em Bun puro para usar o WebSocket nativo e `bun:sqlite` sem camadas intermediárias.

**Rationale:** Separação clara de responsabilidades; o servidor Bun controla WebSocket e MCP; o frontend é estático servido por Vite/CDN.

---

### D2 — Drizzle ORM com SQLite (dev) → PostgreSQL (prod)

**Escolha:** Drizzle ORM define o schema uma vez; o driver de conexão é trocado via variável de ambiente (`DATABASE_URL`). Em dev: `bun:sqlite`. Em prod: driver `postgres` (pg).

**Alternativa considerada:** Prisma. Descartado por gerar um runtime binário incompatível com Bun em algumas versões e por ter licença BSL nos toolings mais recentes.

**Rationale:** Drizzle é Apache 2.0, roda nativamente em Bun, tem migrações simples e SQL explícito — sem magic.

---

### D3 — Segurança: JWT stateless + RBAC server-side

**Escolha:** Login gera um JWT assinado (HS256) armazenado em cookie `HttpOnly; Secure; SameSite=Strict`. Toda rota de API valida o JWT e verifica permissão do usuário contra o recurso no banco — nunca confia no ID vindo da URL sem checar ownership.

**Anti-IDOR:** Toda query inclui `WHERE project_id IN (SELECT project_id FROM memberships WHERE user_id = ?)`. Nenhum endpoint retorna registro sem confirmar membership.

**MVP:** Usuário provisionado por seed/setup local. A troca para banco de usuários real não muda a lógica de autorização.

---

### D4 — Hierarquia de dados: autorrelacionamento em tasks

**Escolha:** A tabela `tasks` possui campo `parent_id` opcional (FK para a própria tabela). A hierarquia `Epic → Story → Task → Subtask` é implementada como: Epic e Story são entidades separadas no banco (para queries de swimlane e board mais eficientes); subtasks são tasks com `parent_id` apontando para outra task.

**Leaf Rule:** Uma task é considerada "folha" se `SELECT COUNT(*) FROM tasks WHERE parent_id = task.id` = 0. Apenas tasks folha aparecem no Kanban como cards móveis. Tasks pai exibem progresso calculado: `(tasks_folha_concluídas / total_tasks_folha) * 100`.

**Alternativa considerada:** Hierarquia inteiramente via `parent_id` desde Epic. Descartado por dificultar queries de swimlane (JOIN recursivo para encontrar o épico raiz de uma subtask seria custoso sem CTE).

**Rationale:** Separar Epic e Story como entidades próprias torna as queries de board diretas; o autorrelacionamento começa no nível de Task para subtasks ilimitadas.

---

### D5 — Breadcrumb dinâmico nos cards

**Escolha:** Cada task armazena o caminho completo desnormalizado como array JSON de ancestrais (`ancestry_path: [{id, title, type}]`). Este campo é atualizado em cascade quando um ancestral é renomeado ou movido.

**Alternativa considerada:** Calcular o caminho em tempo real via JOIN recursivo a cada renderização. Descartado por custo de query em boards com muitos cards.

**Rationale:** Desnormalizar o caminho torna a renderização do breadcrumb O(1). O custo de manutenção (atualizar ancestry_path em cascata) ocorre apenas em operações de rename/move de ancestrais — raras.

---

### D6 — Shadow Markdown: PATCH com conteúdo completo

**Escolha:** `GET /projects/{id}/board.md` retorna o board em Markdown. `PATCH` recebe markdown completo; servidor faz diff e executa operações.

**Rationale:** LLMs já "pensam" em markdown. O formato retornado é o mesmo que o Claude Code geraria num `.md` local — zero fricção cognitiva.

---

### D7 — Realtime via WebSocket nativo do Bun

**Escolha:** Bun tem WebSocket built-in. Servidor mantém mapa de conexões por projeto e faz broadcast de eventos tipados.

---

### D8 — Tree View como query hierárquica com CTE recursivo

**Escolha:** A Tree View usa uma query SQL com CTE recursivo (`WITH RECURSIVE`) para buscar toda a árvore do projeto em uma única query. O frontend recebe a estrutura achatada com campo `depth` e `parent_id` e monta a árvore em memória.

**Alternativa considerada:** Múltiplas queries em cascata (buscar epics, depois stories de cada epic, depois tasks de cada story). Descartado por N+1 queries.

**Rationale:** CTE recursivo é suportado por SQLite (3.35+) e PostgreSQL nativamente. Uma única query retorna toda a árvore com depth e parent_id; o frontend ordena e renderiza a indentação.

---

### D9 — Tags como entidade do projeto com relação N:N

**Escolha:** Tabela `tags` vinculada ao projeto (`project_id`). Relação N:N com tasks via tabela `task_tags`. Tags têm nome e cor. São compartilhadas por todos os membros do projeto.

**Alternativa considerada:** Tags como array JSON no campo da task. Descartado por impossibilitar filtros eficientes e renomeação global de uma tag.

**Rationale:** Entidade própria permite filtrar por tag via JOIN, renomear a tag em um lugar e refletir em todos os cards, e gerenciar o catálogo de tags do projeto.

---

### D10 — Status base vs. colunas do board (Leaf Rule)

**Escolha:** O banco armazena o status base da task (`NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `DONE`, `CANCELLED`) e a `column_id`. Ao mover um card (apenas tasks folha), o sistema aplica o status base da coluna destino. Tasks pai têm status calculado com base nas tasks folha descendentes.

---

### D11 — Servidor MCP integrado ao backend Bun

**Escolha:** O servidor MCP roda como processo separado (`apps/mcp`) compartilhando o banco via Drizzle. Transport stdio.

**Rationale:** MCP SDK usa stdio transport que não encaixa no ciclo request/response HTTP do Hono.

## Risks / Trade-offs

| Risco | Mitigação |
|---|---|
| Atualização em cascade do `ancestry_path` pode ser lenta em árvores muito profundas | Limitar profundidade máxima de subtasks (ex: 5 níveis); atualizar ancestry_path de forma assíncrona |
| CTE recursivo no SQLite pode ter performance degradada em projetos com centenas de tasks | Paginar a Tree View por módulo/épico; SQLite 3.35+ suporta CTE eficientemente |
| Leaf Rule pode confundir usuários que tentam mover uma task pai | UI deve desabilitar visualmente o drag-and-drop em tasks pai e exibir tooltip explicativo |
| Shadow Markdown PATCH com tasks aninhadas aumenta complexidade do diff | Incluir ID de cada task no markdown como âncora; usar IDs não títulos para resolver moves |
| JWT sem revogação — logout não invalida tokens existentes | TTL curto (1h); blocklist opcional em iteração futura |
| dnd-kit pode ter conflitos de acessibilidade em alguns browsers | Testar com teclado; dnd-kit tem suporte nativo a acessibilidade |
| MCP stdio transport não funciona em ambiente serverless | Deploy do MCP como processo long-running |

## Migration Plan

1. Inicializar monorepo e instalar dependências
2. Definir schema Drizzle completo e rodar migrações em SQLite local
3. Implementar backend (auth → projetos → módulos → epics → tasks → WebSocket → MCP)
4. Implementar frontend (login → board → drag-and-drop → tree view → realtime)
5. Implementar Shadow Markdown e servidor MCP
6. Para produção: trocar `DATABASE_URL` para PostgreSQL e rodar `drizzle-kit migrate`

### D12 — Multi-tenancy: shared schema com row-level isolation

**Escolha:** Todas as tabelas possuem coluna `tenant_id` (FK para tabela `tenants`). Middleware resolve o `tenant_id` do JWT ou da API Key e injeta no contexto da requisição. Todo helper de query do Drizzle recebe `tenantId` como parâmetro obrigatório — nunca opcional. Índices compostos `(tenant_id, id)` e `(tenant_id, project_id)` nas tabelas de maior volume.

**Alternativa considerada:** Schema-per-tenant (um schema PostgreSQL por cliente). Isolamento mais forte, mas: (a) SQLite não suporta múltiplos schemas, inviabilizando o desenvolvimento local; (b) Drizzle não tem suporte nativo a schema switching dinâmico; (c) overhead operacional alto para MVP.

**Alternativa considerada:** Database-per-tenant. Máximo isolamento, mas inviável no MVP: gerenciamento de múltiplas conexões, migrações por banco, custo operacional alto.

**Rationale:** Shared schema com `tenant_id` é o padrão adotado por produtos SaaS maduros (Linear, Notion, Vercel) por sua simplicidade operacional. O risco de cross-tenant leak é mitigado pelo helper de query obrigatório que inclui `tenant_id` em toda operação — equivalente ao anti-IDOR mas no nível de tenant. A migração futura para schema-per-tenant é possível trocando apenas o middleware de resolução de conexão.

**Tenant no JWT:** `{ userId, tenantId, role }` — tenant_id é incluído no payload no momento do login e não pode ser alterado pelo cliente.

**Script de setup:** `bun run setup` cria tenant + usuário admin. Sem endpoint de API para criação de tenants. Sem UI. Expansão para admin panel e onboarding de clientes é projeto futuro separado.

---

### D13 — Rich text com Tiptap (MIT)

**Escolha:** Tiptap como editor rich text para descrições de stories e cards. Armazena o conteúdo como markdown no banco. O frontend renderiza markdown como HTML ao exibir e usa o editor visual ao editar.

**Alternativa considerada:** Quill (BSD) e Slate.js (MIT). Tiptap foi preferido por ter integração nativa com React, suporte a markdown input/output, extensões bem mantidas e ser MIT.

**Rationale:** Armazenar como markdown garante portabilidade (o Shadow Markdown pode incluir as descrições), interoperabilidade com agentes de IA e leitura humana direta.

---

### D14 — Internacionalização com i18next (MIT)

**Escolha:** `i18next` + `react-i18next` (ambos MIT) com arquivos de tradução JSON por namespace (`common`, `board`, `auth`, etc.). PT-BR como idioma padrão. Idioma selecionado pelo usuário persistido no banco (campo `language` no user).

**Alternativa considerada:** `react-intl` (BSD). i18next foi preferido por ter ecossistema maior, detecção automática de idioma e namespace por feature — mais fácil de expandir.

---

### D14 — Tema claro/escuro via Tailwind dark mode

**Escolha:** Tailwind configurado com `darkMode: 'class'`. Toggle adiciona/remove a classe `dark` no `<html>`. Preferência salva em `localStorage` e no banco (campo `theme` no user) para persistir entre sessões e dispositivos.

**Rationale:** Tailwind dark mode via classe é a abordagem com menos overhead — sem JavaScript em runtime além de um toggle de classe.

---

### D15 — Armazenamento de arquivos: filesystem local (MVP) com abstração

**Escolha:** MVP armazena uploads no filesystem local (`/uploads/` servido pelo Bun como rota estática). Interface `StorageAdapter` abstrai as operações (`upload`, `delete`, `getUrl`); trocar para S3 ou outro provider é implementar um novo adapter sem mudar a lógica de negócio.

**Imagens inline:** Lightbox no frontend com React — biblioteca `yet-another-react-lightbox` (MIT) para visualização de imagens sem sair do board.

**Alternativa considerada:** Base64 no banco. Descartado por inflar o banco e degradar performance de queries.

---

### D16 — Pontuação de tasks com agregação recursiva

**Escolha:** Campo `points` (inteiro, nullable) na tabela `tasks`. Apenas tasks folha recebem pontuação direta. Pontos nos níveis superiores (story, epic, módulo) são calculados via `SUM(points)` sobre as tasks folha descendentes — mesma lógica do cálculo de progresso, mas somando em vez de dividir.

**Rationale:** Consistente com a Leaf Rule — a fonte de verdade sempre são as tasks folha. Agregar no banco a cada query (via CTE) é mais simples do que manter totais desnormalizados que precisariam de cascade updates.

## Open Questions

- Qual o limite máximo de profundidade de subtasks? (recomendado: 5 níveis)
- O breadcrumb no card exibe o caminho completo por padrão ou apenas o nível imediato pai, expandindo ao hover?
- Tags devem ter cor customizável por projeto, ou paleta fixa?
- O servidor MCP deve ter transport HTTP/SSE além de stdio para suportar conexões remotas?
- Cards devem ter histórico de movimentações (audit log)? Útil para debugging de agentes de IA.
