# Design — hierarchy-level-toggles

## Context

Ver `proposal.md`. Estado atual relevante:

- `projects` guarda `board_mode` (`HIERARCHICAL` | `SIMPLE`) e `simple_story_id`
  (`apps/api/src/db/schema.ts`).
- A hierarquia é Módulo → Épico → História → TASK/BUG → subtask, com
  `parent_id`/`module_id` e `ancestry_path` desnormalizado (`task-hierarchy`).
- A conversão entre modos vive em `convertProjectBoardMode`
  (`apps/api/src/db/sqlite/projectUnitOfWork.ts`): cria/reutiliza a STORY fixa,
  reparenta cards, remove módulos/épicos e emite eventos. No adapter **PostgreSQL
  é `NOT_IMPLEMENTED`** (`apps/api/src/db/postgres/adapter.ts`).
- No frontend, `BoardScreen` já ramifica por `boardMode`/`isSimpleBoard` e
  `BoardLanes` decide módulos vs. épico vs. lane simples; a Tree View
  (`TreeViewPage`) monta a árvore a partir dos itens. O toolbar
  (`BoardCommandBar`) filtra os botões de criação por `boardMode`.

## Goals / Non-Goals

- **Goals**: opções independentes de ocultar módulos/épicos em `HIERARCHICAL`;
  recolhimento transacional a item único; exibição coerente no Kanban e na Tree
  View; reversibilidade; paridade SQLite ↔ PostgreSQL.
- **Non-Goals**: alterar o modo `SIMPLE` ou sua STORY fixa; implementar a
  conversão de `boardMode` no Postgres (lacuna adjacente, fora deste escopo);
  reescrever a modelagem de módulos/épicos.

## Decisions

### D1 — Duas colunas booleanas no projeto

Adicionar `hide_modules` e `hide_epics` (boolean, default `false`) em `projects`,
via migration aditiva. `NewProjectRecord`/`ProjectPatch`/`ProjectRecord` passam a
expor `hideModules`/`hideEpics`. As opções são **ignoradas** quando
`boardMode = SIMPLE` (que já colapsa tudo). Sem backfill: projetos existentes
ficam com ambas `false`.

### D2 — Serviço de recolhimento no unit of work, com paridade

Adicionar `collapseProjectHierarchy(context, projectId, options, patch)` ao
`unitOfWork`, espelhando `convertProjectBoardMode`:

- **SQLite** (`projectUnitOfWork.ts`): dentro de uma transação atômica, garantir
  um módulo único (reutilizar o primeiro se existir; senão criar `Geral`),
  reparentar épicos/histórias a ele e remover módulos supérfluos; garantir um
  épico único por módulo (criar `Fluxo contínuo` quando não houver), reparentar
  histórias e remover épicos supérfluos. Emitir `projectMetadataChanged` e eventos
  de item (reparent), preservando IDs/conteúdo.
- **PostgreSQL** (`postgres/adapter.ts`): implementar a mesma operação com `tx`,
  substituindo o `NOT_IMPLEMENTED` **apenas para o recolhimento** (a conversão de
  modo continua fora do escopo), com SQL equivalente e os mesmos eventos.

As duas implementações compartilham o mesmo contrato de porta e são cobertas por
testes de paridade.

Alternativa considerada: implementar só no SQLite — rejeitada, pois produção
(perfil ADVANCED) usa PostgreSQL.

### D3 — Recolhimento por nível, independente

- `hideModules`: garante **um módulo**; épicos são movidos para ele.
- `hideEpics`: garante **um épico por módulo**; histórias são movidas para ele.
  Com módulos também ocultos, o épico único fica sob o módulo único.
- Ligar uma opção dispara o recolhimento daquele nível; desligar apenas atualiza a
  flag (sem recriar o que foi fundido), exibindo novamente o item único.

### D4 — Exibição derivada no frontend

O contexto do board expõe as flags e deriva os níveis efetivos
(`isSimpleBoard || hideModules` ⇒ sem módulos; `isSimpleBoard || hideEpics` ⇒ sem
épicos). `BoardLanes` renderiza épico direto/sob módulo/histórias diretas
conforme os níveis efetivos; `TreeViewPage` monta a raiz pulando os níveis
ocultos. O toolbar esconde `+ Módulo`/`+ Novo Épico`, o filtro de módulos e as
seções de módulo; criação de épico/história vincula-se automaticamente ao item
único. As mudanças são invalidadas por tempo real como as demais flags do projeto.

### D5 — Confirmação ao ligar (recolhimento destrutivo)

Ligar uma opção funde/remove módulos/épicos supérfluos. A UI SHALL pedir
confirmação antes de ligar (reusando o padrão do diálogo de conversão `SIMPLE`),
informando que os itens daquele nível serão recolhidos a um único e que os cards
serão preservados. Desligar não exige confirmação. Reversível conforme o card:
o item único pode ser renomeado e novos podem ser criados.

### D6 — API

`GET /projects/:id` retorna as duas flags; `PATCH /projects/:id` (ADMIN) aceita
`hideModules`/`hideEpics` e, ao ligar, dispara o recolhimento; `POST /projects`
aceita as flags na criação. MEMBER/VIEWER leem sem alterar. Validação reusa o
schema de update do projeto, com rejeição de valores não booleanos.

## Risks / Trade-offs

- [Recolhimento é destrutivo para módulos/épicos supérfluos] → confirmação
  explícita ao ligar; cards/IDs/conteúdo preservados; desligar reexibe o item único.
- [Paridade SQLite ↔ Postgres] → testes de paridade cobrindo recolhimento, eventos
  e isolamento por tenant/projeto.
- [Realtime] → após o recolhimento, emitir `projectMetadataChanged` (e invalidação
  do board) para reconciliar clientes conectados.
- [Ancestry e progresso] → reparent recalcula `ancestry_path`; agregadores de
  progresso passam a refletir a nova estrutura.
- [Lacuna adjacente: conversão de `boardMode` no Postgres] → registrada, fora do
  escopo; não altera o comportamento atual.

## Migration Plan

Migration aditiva (duas colunas booleanas com default `false`), sem backfill nem
perda de dados. Deploy é código + migration; rollback = reverter o commit (as
colunas podem permanecer, sem efeito). `bun run check`, `bun run test:smoke` e os
testes de migration/paridade cobrem a verificação.

## Open Questions

Nenhuma pendente que altere specs, abordagem ou tarefas.
