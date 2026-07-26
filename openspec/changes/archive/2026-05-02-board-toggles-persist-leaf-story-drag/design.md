## Context

O board possui dois tipos de estado de visualização que não faziam parte dos filtros persistidos: os toggles `showSubtasks` e `showStories` (variáveis React standalone) e o conjunto de swimlanes recolhidas `collapsedEpics` (Set em memória). Ambos eram perdidos ao navegar para outra página ou recarregar o browser.

Paralelamente, a Leaf Rule permitia apenas TASK/BUG folha no Kanban. Histórias sem tarefas (isLeaf = true) existiam no banco com `columnId = null` e `status = NOT_STARTED`, mas não podiam ser movidas — ficavam presas como cards virtuais sem arrastar.

## Goals / Non-Goals

**Goals:**
- Incluir `showSubtasks` e `showStories` em `BoardFilterState` para persistência automática junto com os demais filtros
- Persistir `collapsedEpics` em chave `localStorage` separada (é um Set de IDs, não um filtro booleano)
- Retrocompatibilidade: estados salvos antes desta mudança (sem `showSubtasks`/`showStories`) continuam funcionando via merge com `DEFAULT_FILTERS`
- Histórias folha aparecem como cards reais no board com ID verdadeiro, arrastáveis entre colunas
- `DEFAULT_FILTERS.showStories = true` — padrão visível para boards novos

**Non-Goals:**
- Persistir o estado de scroll horizontal do board
- Histórias não-folha como cards arrastáveis (continuam como cards virtuais não-móveis)
- Migração de dados no banco para histórias já existentes sem `columnId`

## Decisions

### 1. showSubtasks e showStories dentro de BoardFilterState (não em estado separado)

**Decisão:** Mover para `BoardFilterState` em vez de manter como `useState` separado.

**Rationale:** O `useEffect` de persistência já serializa `filters` para `localStorage`. Incorporar os toggles elimina duplicação de código de persistência/restauração. A alternativa seria um segundo `useEffect` com outra chave — mais ruído, mesmo resultado.

**Alternativa considerada:** Chave `board-view:<projectId>` separada para toggles de visualização. Descartada porque o clear de filtros precisaria coordenar dois estados, e o merge de retrocompatibilidade ficaria mais complexo.

### 2. collapsedEpics em chave localStorage própria

**Decisão:** `board-collapsed-epics:<projectId>` como JSON array de IDs.

**Rationale:** `collapsedEpics` é um `Set<string>` de IDs — não é um valor escalar que se encaixe no shape de `BoardFilterState`. Serializar como array JSON é simples; IDs de épicos excluídos ficam no Set mas são ignorados (o épico não existe mais).

### 3. Histórias folha como cards reais em boardCards (não virtuais)

**Decisão:** Separar o fluxo: histórias folha → `boardCards` com ID real; histórias não-folha → `storyVirtualCards` com prefixo `story-virtual-*`.

**Rationale:** Cards virtuais usam IDs sintéticos para evitar conflito com o DnD. Um card real com ID verdadeiro pode ser encontrado em `allItems` pelo `handleDragEnd`, permitindo chamar a API de move normalmente. Usar ID real também evita lógica especial no `handleOpenDetail` para cards que parecem virtuais mas são arrastáveis.

**Alternativa considerada:** Estender o handleDragEnd para desprefixa `story-virtual-*` e tratar como movível. Descartada porque mistura semântica de "card de referência" com "card de trabalho".

### 4. columnId default = columns[0] apenas no lado cliente

**Decisão:** Ao renderizar uma história folha sem `columnId`, o frontend usa `s.columnId ?? firstColId` apenas para exibição. O banco é atualizado somente quando o usuário efetivamente move o card (chamada à API).

**Rationale:** Evita writes desnecessários ao banco na abertura do board. A primeira vez que o usuário arrasta a história, o `handleDragEnd` chama move → banco recebe `columnId` real.

**Trade-off:** Enquanto a história não for movida, ao abrir o board ela sempre aparece na primeira coluna, independente da posição visual anterior — comportamento aceitável pois indica status inicial.

### 5. API /move aceita STORY com isLeaf check

**Decisão:** Adicionar `STORY` ao tipo permitido, mantendo o `isLeaf` check server-side.

**Rationale:** O check de `isLeaf` no servidor impede que histórias com tarefas (não-folha) sejam movidas via API diretamente, mesmo que alguém tente por fora do frontend. Consistente com o tratamento de TASK/BUG não-folha.

## Risks / Trade-offs

- **Estado stale de collapsedEpics**: Se um épico for excluído, seu ID permanece no Set persistido. Risco baixo — IDs órfãos são ignorados silenciosamente (o épico não existe em `epics` memo).
- **Retrocompatibilidade parcial do showStories**: Usuários com `board-filters` salvo sem `showStories` receberão o valor de `DEFAULT_FILTERS.showStories = true` na primeira abertura pós-deploy. Isso é intencional — o padrão muda para "histórias visíveis".
- **História folha sem columnId na primeira renderização**: Aparece sempre na col[0] até ser movida. Aceitável como comportamento inicial.
- **STORY pode ser movida para coluna "Concluído" sem nenhuma task**: Isso é explicitamente o objetivo do requisito — a história representa um entregável autônomo rastreado pelo board.
