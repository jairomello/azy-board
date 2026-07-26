## Context

O `BoardPage.tsx` já realiza um `Promise.all` na inicialização para carregar colunas, itens, módulos, tags, sprints, membros, versões, centros de custo e squads. O endpoint `GET /projects/:projectId` existe e retorna `{ id, name, description, ... }`. O nome do projeto simplesmente nunca foi incluído nessa carga inicial.

## Goals / Non-Goals

**Goals:**
- Exibir o nome do projeto no breadcrumb do header: `Projetos › Board · <Nome>`
- Definir `document.title` com o nome do projeto para identificação na aba do browser
- Carregar o nome junto com os demais dados de inicialização (sem request extra)

**Non-Goals:**
- Tornar o nome do projeto editável inline no breadcrumb
- Exibir o nome em outras páginas (settings, tree view já herdará via BoardPage)

## Decisions

### 1. Carregar nome via GET /projects/:projectId no Promise.all existente

**Decisão:** Incluir `api.get<{ name: string }>(`/projects/${projectId}`)` no `Promise.all` já existente em `BoardPage.tsx`.

**Rationale:** Centraliza toda a inicialização em uma única barreira de carregamento. Sem waterfall de request, sem estado de loading separado. O endpoint já existe e retorna `name` junto com outros dados do projeto.

**Alternativa considerada:** Context global de projeto (ex.: `ProjectContext`) que qualquer componente pudesse consumir. Descartada por complexidade desproporcional a uma exibição simples no header.

### 2. Formato do breadcrumb: separador `·` entre "Board" e o nome

**Decisão:** `Projetos › Board · <Nome do Projeto>` — nome em `text-foreground font-medium`, separador `·` em `text-muted-foreground`.

**Rationale:** Mantém hierarquia visual clara. "Projetos" e "Board" indicam localização; o nome é contexto adicional. O separador `·` é mais suave que `›` (que indica navegação) e não confunde o usuário sobre se "Nome" é clicável.

### 3. document.title

**Decisão:** `useEffect` simples: `document.title = projectName ? \`${projectName} · Board\` : 'Board'`.

**Rationale:** Melhoria gratuita de UX — o usuário com várias abas abertas sabe qual projeto está em cada aba.

## Risks / Trade-offs

- **Loading state:** Durante o carregamento, `projectName` será `''` e o breadcrumb mostrará apenas "Board". O spinner global já cobre essa janela (`loading = true`), então não há flash indesejado.
- **Erro no fetch do projeto:** Se `GET /projects/:projectId` falhar (raro — o usuário já está autenticado e tem acesso ao board), o nome simplesmente não é exibido. O board continua funcionando normalmente pois o erro é tratado com `.catch(() => ({ name: '' }))`.
