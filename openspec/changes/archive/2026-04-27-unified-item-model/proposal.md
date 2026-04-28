## Why

O sistema atual mantém Épicos, Histórias e Tasks em tabelas separadas (`epics`, `stories`, `tasks`), criando três caminhos distintos de CRUD, JOINs cruzados obrigatórios e inconsistências de UI (botões e modais que tratam entidades diferentes). A tabela `tasks` já possui `parentId` auto-referenciado e `type: TASK | BUG | STORY`, indicando que a estrutura unificada é a evolução natural da arquitetura.

## What Changes

- **BREAKING — Nova tabela `items`**: substitui as tabelas `epics`, `stories` e `tasks`. Cada linha tem `type: EPIC | STORY | TASK | BUG` e `parentId` auto-referenciado para compor a hierarquia inteira numa única entidade.
- **BREAKING — Tabelas removidas**: `epics` e `stories` são dropadas; todas as FKs que apontavam para elas passam a apontar para `items`.
- **Campos unificados**: a tabela `items` acomoda todos os campos das três entidades. Campos específicos de tipo ficam nullable (ex: `persona`, `goal`, `benefit` são relevantes apenas para `STORY`; `columnId` e `priority` apenas para `TASK` e `BUG`).
- **`moduleId` em EPICs**: EPICs mantêm `moduleId` para preservar a relação com módulos. Os demais tipos herdam o módulo via ancestral.
- **Regra de hierarquia (validação de negócio)**: EPIC → filho de módulo (sem parentId em items); STORY → filho de EPIC; TASK/BUG → filho de STORY ou de outro TASK/BUG (subtask). Validado na camada de serviço.
- **Leaf Rule inalterada**: apenas items sem filhos aparecem como cards móveis no Kanban.
- **Interface `Card`**: contrato TypeScript aplicado pelo padrão Adapter — qualquer tipo de item pode ser renderizado como card se satisfizer a interface `Card`.
- **Botões de criação no toolbar**: `+ Novo Épico`, `+ Nova História`, `+ Nova Task`, `+ Novo Bug` (nesta ordem). Cada um abre a modal correspondente ao tipo.
- **Modais diferenciadas por tipo**: EPIC e STORY mantêm seus campos específicos (rich text, campos ágeis); TASK e BUG mantêm seus campos operacionais. A modal é selecionada pelo `type` do item.
- **Migration por seed**: os dados existentes são descartados; novo seed popula a tabela `items` com dados de exemplo representativos de todos os tipos.
- **Rotas de API unificadas**: `/projects/:id/items` substitui `/epics`, `/stories` e `/tasks`. Filtros por `type`, `parentId` e `columnId` cobrem todos os casos de uso anteriores.

## Capabilities

### New Capabilities

- `unified-item-model`: Tabela `items` auto-referenciada com `type` discriminante; interface `Card` como contrato Adapter; rotas `/items` unificadas; validação de hierarquia por tipo na camada de serviço.

### Modified Capabilities

- `task-hierarchy`: Hierarquia completa (EPIC → STORY → TASK → subtask) agora em uma única tabela com `parentId`; `ancestryPath` desnormalizado mantido para O(1) no breadcrumb.
- `board-management`: Kanban lê `items` com `type IN (TASK, BUG)` e leaf rule; swimlanes de épico lêem `items` com `type = EPIC`.
- `card-types`: Adiciona `EPIC` como tipo; cada tipo tem badge e cor próprios; modal selecionada por `type`.
- `epic-story-ui`: Quatro botões de criação no toolbar (`+ Novo Épico`, `+ Nova História`, `+ Nova Task`, `+ Novo Bug`); modais diferenciadas por tipo substituem a separação atual entre `EpicModal` e `StoryModal`.
- `tree-view`: Tree lê recursivamente de `items` via `parentId`; nós com `type = EPIC` agrupam STORYs; nós com `type = STORY` agrupam TASKs/BUGs.
- `epic-tracking`: Épicos passam a ser itens comuns com `type = EPIC`; progresso calculado somando `points` dos descendentes folha via CTE recursivo.
- `card-creation-ui`: Formulário rápido de criação (`AddCardForm`) passa a receber `type` como prop e envia para `/items`.

## Impact

- **Banco de dados**: drop de `epics` e `stories`; criação de `items`; atualização de FKs em `task_tags`, `task_sprints` e `attachments` (renomeadas para `item_tags`, `item_sprints`, `item_attachments`).
- **API**: todas as rotas `/epics` e `/stories` removidas; `/tasks` substituído por `/items`; queries com filtros de `type` cobrem os casos de uso anteriores.
- **Frontend**: `BoardPage.tsx`, `TreeView`, `EpicModal`, `StoryModal`, `CardModal`, `KanbanCard`, `AddCardForm` e `BoardFilters` refatorados para consumir `/items`.
- **Seed**: script `seed.ts` reescrito para popular apenas a tabela `items` com exemplos de todos os tipos.
- **Sem novas dependências**: a mudança é puramente estrutural.
