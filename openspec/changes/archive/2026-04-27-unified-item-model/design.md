## Context

Hoje o sistema mantém três tabelas separadas para representar a hierarquia de trabalho: `epics` (swimlanes), `stories` (agrupadores) e `tasks` (unidade de execução com subtasks via `parentId`). A tabela `tasks` já possui `parentId` auto-referenciado, `ancestryPath` desnormalizado e o campo `type: TASK | BUG | STORY`, o que significa que a estrutura já suporta a ideia central da unificação — falta apenas estendê-la para cobrir EPIC e remover as tabelas redundantes.

## Goals / Non-Goals

**Goals:**
- Unificar `epics`, `stories` e `tasks` em uma única tabela `items` com `type` discriminante
- Expor um contrato TypeScript `Card` que qualquer tipo de item satisfaz para ser renderizado no board
- Consolidar todas as rotas de CRUD em `/projects/:id/items` com filtros por `type`
- Manter Leaf Rule, `ancestryPath`, progresso e pontuação inalterados em comportamento
- Reset de dados via novo seed — sem migration de dados existentes

**Non-Goals:**
- Suporte a tipos adicionais além de EPIC, STORY, TASK, BUG
- Validação de profundidade de hierarquia via constraint de banco (fica na camada de serviço)
- Alteração no modelo de colunas, sprints, tags ou memberships

## Decisions

### 1. Nome da tabela: `items`

**Decisão**: renomear `tasks` para `items`.

**Alternativa considerada**: manter `tasks` e apenas adicionar `EPIC` ao enum. Descartado porque `tasks` como nome cria confusão semântica — um épico não é uma task; o nome `items` é neutro e coerente com o padrão do setor (Linear usa `Issue`, Jira usa `Issue`).

---

### 2. `moduleId` desnormalizado nos EPICs

**Decisão**: manter `moduleId` como coluna na tabela `items`, preenchida apenas quando `type = EPIC`. STORYs, TASKs e BUGs herdam o módulo atravessando a cadeia de ancestrais ou via `ancestryPath`.

**Alternativa considerada**: colocar `moduleId` em todos os itens via desnormalização. Descartado por redundância — o módulo de um item nunca muda independentemente do módulo do seu EPIC pai. Uma query com `JOIN items ON parentId` chega ao módulo sem custo relevante.

**Alternativa considerada**: remover `moduleId` e resolver sempre via recursão. Descartado por custo de query — filtrar o board por módulo sem `moduleId` no EPIC exigiria CTE recursivo em cada request do board, impactando performance.

---

### 3. Hierarquia enforced na camada de serviço

**Decisão**: nenhuma constraint de banco garante "STORY só pode ser filho de EPIC". Toda validação de hierarquia é feita no handler da rota antes de inserir/atualizar.

**Regras**:
- EPIC: `parentId = null`, tem `moduleId` obrigatório
- STORY: `parentId` deve ser um item com `type = EPIC` no mesmo projeto
- TASK / BUG: `parentId` deve ser um item com `type IN (STORY, TASK, BUG)` no mesmo projeto
- Subtask de TASK/BUG: `parentId` aponta para TASK ou BUG (recursão ilimitada, recomendado máx. 5 níveis)

**Alternativa considerada**: CHECK constraint no SQLite. Impossível sem subquery; SQLite não suporta subqueries em CHECK. PostgreSQL suporta via trigger, mas adiciona complexidade de migration futura. Descartado.

---

### 4. Interface `Card` como Adapter

**Decisão**: definir interface TypeScript `Card` em `packages/types/src/card.ts` com os campos mínimos exigidos para renderização no board. Cada tipo de item implementa a interface `Card` via função adapter (`toCard(item): Card`).

```ts
interface Card {
  id: string
  type: ItemType        // 'EPIC' | 'STORY' | 'TASK' | 'BUG'
  title: string
  columnId: string | null
  priority: Priority | null
  points: number | null
  assigneeId: string | null
  tags: Tag[]
  isLeaf: boolean
  ancestryPath: AncestorRef[]
  parentId: string | null
}
```

Cada tipo expõe a mesma forma ao `KanbanCard`, que decide a aparência com base em `type`.

---

### 5. Rotas unificadas em `/items`

**Decisão**:

| Antes | Depois |
|-------|--------|
| `GET /projects/:id/epics` | `GET /projects/:id/items?type=EPIC` |
| `GET /projects/:id/stories` | `GET /projects/:id/items?type=STORY` |
| `GET /projects/:id/tasks` | `GET /projects/:id/items?type=TASK,BUG` |
| `POST /projects/:id/tasks` | `POST /projects/:id/items` (body inclui `type`) |
| `PATCH /projects/:id/tasks/:tid` | `PATCH /projects/:id/items/:iid` |
| `DELETE /projects/:id/tasks/:tid` | `DELETE /projects/:id/items/:iid` |

Rotas específicas mantidas onde necessário (ex: `PATCH /items/:id/move` para mudança de coluna, `PATCH /items/reorder` para reordenação).

---

### 6. Estratégia de seed

**Decisão**: `bun run seed` dropa e recria todas as tabelas, depois insere dados de exemplo com todos os quatro tipos de item representados.

**Sem migration**: dados existentes não são preservados. Decisão deliberada do produto neste momento.

---

### 7. FKs de `task_tags`, `task_sprints` e `attachments`

**Decisão**: renomear tabelas e colunas para referenciar `items`:
- `task_tags` → `item_tags` (coluna `task_id` → `item_id`)
- `task_sprints` → `item_sprints` (coluna `task_id` → `item_id`)
- `attachments.task_id` → `attachments.item_id`

## Risks / Trade-offs

**[Colunas esparsas]** → A tabela `items` terá colunas relevantes apenas para certos tipos (`persona`, `goal`, `benefit` só para STORY; `columnId`, `priority` só para TASK/BUG; `moduleId` só para EPIC). Todas ficam nullable. Aceitável para SQLite e PostgreSQL — sem impacto prático de performance em escala deste produto.

**[Hierarquia sem constraint de banco]** → Um bug no handler poderia criar uma STORY filha de uma BUG, corrompendo a hierarquia. Mitigação: validações explícitas em cada handler de criação/atualização; testes de unidade cobrindo casos inválidos.

**[Refatoração ampla do frontend]** → `BoardPage`, `TreeView`, `CardModal`, `StoryModal`, `EpicModal` e formulários de criação precisam ser atualizados para consumir `/items`. A interface `Card` centraliza a forma dos dados e reduz o risco de divergência.

**[ancestryPath deve ser reconstruído no seed]** → O seed precisa construir o `ancestryPath` corretamente para cada item, incluindo EPIC e STORY. O helper de geração de `ancestryPath` será movido para uma função utilitária reutilizável.
