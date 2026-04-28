## Context

O board já tem a infra de tasks, tags, épicos e histórias funcionando no backend. Os problemas a resolver são: (1) falta de campo `type` em tasks para distinguir Story/Task/Bug; (2) ausência de filtros no board; (3) reordenação de cards não persiste (o campo `position` existe no banco mas não há rota de reorder nem chamada de API no `onDragEnd`); (4) tags não persistem porque o save da `CardModal` não está chamando `POST /tasks/:id/tags` corretamente; (5) dropdown do `TagSelector` aparece atrás de outros elementos por z-index insuficiente; (6) UI de gestão de squads/membros não foi implementada nas Settings; (7) o editor de histórias usa apenas campos de texto simples, sem formatação rica.

Estado atual problemático:
- `tasks.type` não existe no banco — migration necessária
- `onDragEnd` não chama API de reposição vertical (só move coluna)
- `CardModal.handleSave` monta `PATCH` mas não chama `POST tags` de forma confiável
- `TagSelector` usa `position: absolute` dentro do modal scrollável — fica atrás do próximo campo
- Settings não tem seção de squads/membros

## Goals / Non-Goals

**Goals:**
- Campo `type` em tasks com valores `TASK | BUG | STORY` e badge visual no card
- Toggle "Stories como cards" no board — quando ativo, exibe cards de histórias (`stories`) nas colunas (coluna baseada em status da história, a ser adicionado) OU coloca histórias na primeira coluna por padrão
- Filtros no toolbar: módulo, sprint, responsável, tipo de card, tag — filtro aplicado sobre `displayedTasks` client-side
- Rota `PATCH /projects/:id/tasks/reorder` (ou por coluna) para persistir posição vertical
- Correção do bug de tags: garantir que `POST /tasks/:id/tags` é chamado no save e que o payload é correto
- Correção do z-index do TagSelector: usar portal ou `position: fixed`
- Modal de história com editor Tiptap + toolbar (negrito, itálico, h1-h3, lista, lista-numerada, tabela, link)
- Settings: seção "Membros & Squads" com GET /projects/:id/members, criar/renomear squad, adicionar/remover membros

**Non-Goals:**
- Notificações push para mudanças de tipo ou filtro
- Filtros persistidos no servidor (apenas estado local por sessão)
- Histórias com campo `status` próprio (colunas do kanban são de tasks; histórias como cards usam a primeira coluna disponível)
- Edição inline de tipo no card (apenas na modal)

## Decisions

### D1 — Campo `type` na tabela `tasks`: migration Drizzle

**Decisão:** Adicionar `type TEXT NOT NULL DEFAULT 'TASK' CHECK(type IN ('TASK','BUG','STORY'))` na tabela `tasks` via migration Drizzle. O valor `STORY` indica que este card representa uma história do projeto (vinculada à entidade `stories`).

**Alternativa descartada:** Novo campo boolean `isStory` — confuso ao combinar com a entidade `stories` existente.

---

### D2 — Stories como cards no board: copiar stories para tasks ou renderizar separado

**Decisão:** Quando o toggle "Stories como cards" está ativo, fazer `GET /projects/:id/stories` e renderizar as histórias como cards "virtuais" (não tasks reais) no board, usando a primeira coluna como posição padrão. Eles abrirão o `StoryModal` ao clicar, e não serão arrastáveis (semelhante a tasks pai). Não criamos tasks do tipo `STORY` para cada história — mantemos as entidades separadas.

**Alternativa descartada:** Criar tasks do tipo STORY espelhando histórias — gera duplicação e complexidade de sincronização.

---

### D3 — Reordenação vertical de cards: rota de reorder por coluna

**Decisão:** Rota `PATCH /projects/:id/tasks/reorder` com body `{ columnId: string, order: string[] }` — recebe a nova ordem dos IDs e atualiza `position` em cada task em uma transaction. No frontend, ao `onDragEnd` para drag dentro da mesma coluna, chamar `arrayMove`, update otimista no estado e depois a API.

**Alternativa descartada:** `PATCH /tasks/:id/position` individual — gera N chamadas para N cards.

---

### D4 — TagSelector z-index: portal React

**Decisão:** Renderizar o dropdown do `TagSelector` via `createPortal(dropdown, document.body)` com `position: fixed` calculado via `getBoundingClientRect()`. Isso evita que o scroll do modal pai corte ou sobreponha o dropdown.

---

### D5 — Editor rich text para histórias: Tiptap com toolbar customizada

**Decisão:** Usar o Tiptap já instalado e adicionar extensões `Table`, `Typography`, `TextAlign` (todas MIT). Criar componente `<RichTextEditor>` com toolbar de botões (bold, italic, h1, h2, h3, bulletList, orderedList, table, link). Reutilizável no `StoryModal` e na `CardModal` (descrição da task).

---

### D6 — Gestão de membros: novos endpoints GET

**Decisão:** Adicionar `GET /projects/:id/members` retornando usuários com seus squads, e `GET /projects/:id/squads` retornando squads com membros. No frontend, nova seção em `SettingsPage` com UI para criar squad, adicionar membro por e-mail (lookup de usuário no tenant), e remover.

## Risks / Trade-offs

| Risco | Mitigação |
|---|---|
| Migration `tasks.type` quebra dados existentes | DEFAULT 'TASK' garante retrocompatibilidade; sem dados a migrar em dev |
| Stories como cards "virtuais" no board não são arrastáveis | Indicador visual claro (badge STORY + cursor default) |
| Portal do TagSelector pode ter posicionamento incorreto ao rolar a página | Calcular posição no `onOpen` e re-calcular no `resize` se necessário |
| Tiptap Table extension requer CSS adicional | Adicionar `.ProseMirror table` styles no globals.css |
| GET /members pode retornar usuários de outros projetos do mesmo tenant | Filtrar por `memberships.projectId` no endpoint |

## Migration Plan

1. Gerar migration Drizzle: `bun drizzle-kit generate` para `tasks.type`
2. Rodar migration em dev: `bun drizzle-kit push`
3. Deploy: migration roda antes do restart do servidor (sem downtime para SQLite)
