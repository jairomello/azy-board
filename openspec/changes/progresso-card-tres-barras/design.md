# Design

## Context

Ver `proposal.md` para a motivação. O estado atual relevante:

- `packages/domain/src/progress.ts` é a fonte única do avanço: `createAdvanceResolver`
  escolhe a faixa pelo status, refina pela coluna e, quando existe checklist, posiciona o
  card dentro da faixa entre a coluna anterior e a atual (`computeAdvance`). Lanes, árvore,
  dashboard, listagem de projetos, cabeçalho de sprint e card usam essa função.
- O card (`apps/web/src/components/KanbanCard.tsx`) já recebe `advance` pronto do board e
  `checklistProgress` agregado de todos os checklists (`checked`/`total`). O rodapé mostra
  `childrenCount` como contagem, sem qualquer indicador de avanço dos filhos.
- O board carrega todos os itens do projeto em `allItems`; histórias não-folha aparecem
  como cards virtuais (`story-virtual-<id>`) e são as principais ocorrências de card com
  subtasks no Kanban.
- `ProgressBar` centraliza trilho, marcas, gradiente e transição; as cores vêm de tokens
  CSS (`--status-*`, `--primary`, `--status-review`) e há neutralização de movimento.

## Goals / Non-Goals

**Goals:**

- Tirar o checklist do progresso em todos os cálculos, sem divergência entre card,
  lane, árvore e dashboard.
- Exibir até três barras no card, cada uma com identidade visual e nome acessível próprios.
- Calcular as barras secundárias sem novo endpoint nem N+1, reutilizando dados já carregados.

**Non-Goals:**

- Não mudar o modelo de colunas, pesos explícitos nem o fluxo de configuração do projeto.
- Não alterar o contrato REST/MCP dos itens (`checklistProgress` e `childrenCount` continuam
  como estão).
- Não substituir contadores, etiquetas de status ou o rodapé do card.
- Não criar indicadores equivalentes em outros lugares além do card nesta change.

## Decisions

### 1. Remover o checklist do domínio, não apenas da UI

**Escolhido:** `computeAdvance` passa a devolver o peso da coluna e `AdvanceItem` deixa de
receber `checklist`; `createAdvanceResolver` não consulta mais o progresso de checklist.

**Por quê:** o requisito de "mesmo percentual em todas as telas" exige que a regra mude na
fonte única. Esconder o checklist só no card faria a lane dizer 25% e o card 50% para o
mesmo item. Os chamadores que passam `checklist` hoje (`treeProgress`, `cardAdvance`,
`itemsAdvance` do board) passam a não passar nada.

**Alternativas descartadas:**

- *Manter o checklist no resolver e só ocultar na barra do card:* cria divergência entre
  card e agrupadores, exatamente o que a capability quer evitar.
- *Novo parâmetro `refineWithChecklist` por tela:* aumenta a superfície de configuração e
  permite estados incoerentes entre telas.

**Consequência:** o percentual de progresso de itens com checklist pode cair (ex.: card em
"Fazendo" com 5/10 checklists marcados passa de 25% para 50%). É uma mudança de produto
intencional e documentada; não há migração de dados.

### 2. Barra de checklist usa o agregado já existente

**Escolhido:** a barra de checklist usa `checklistProgress.checked/total`, que a API já
agrega de todos os checklists do item e mantém via realtime. Percentual =
`checked / total`, exibido com o contador `12/20` atual.

**Por quê:** zero consultas novas, zero mudança de contrato e atualização em tempo real
de graça. O agregado é exatamente "vários checklists, uma barra".

**Alternativa descartada:** buscar cada checklist no cliente — N+1 e risco de divergência
com a contagem já exibida.

### 3. Barra de subtasks calculada no board a partir dos filhos carregados

**Escolhido:** um helper no model do board (`subtasksProgressByParent`) agrupa `allItems`
por `parentId`, exclui filhos `CANCELLED`/`ARCHIVED` e calcula a média com
`createAdvanceResolver` (status + coluna, sem checklist). O card recebe
`subtasksProgress: { advance, total } | null`. Cards virtuais de história resolvem o id real
antes da consulta.

**Por quê:** o board já tem todos os itens do projeto; calcular em memória evita endpoint,
campo novo no contrato e consultas por card. A mesma regra de avanço do item é reutilizada,
então a média das subtasks é coerente com o percentual que cada filho teria no card.

**Alternativas descartadas:**

- *Novo campo por item na API:* contrato maior, mais um cálculo agregado no servidor e
  necessidade de manter web/MCP sincronizados sem ganho real para o board.
- *Média recursiva de todos os descendentes:* mais caro e fora do escopo — o requisito fala
  das subtasks diretas do card.

**Consequência:** se um filtro esconder filhos, a barra considera apenas os filhos presentes
em `allItems`; sem filhos válidos, a barra some.

### 4. Três barras na mesma região, com papéis visuais distintos

**Escolhido:** a região entre tags/tipo e rodapé passa a renderizar, nesta ordem:

1. **Progresso** — `ProgressBar` atual (6 px, gradiente `--primary` → `--status-review`,
   marcas a 25%, glow discreto, token de concluído em 100%).
2. **Checklist** — 4 px, sólida, família teal/ciano, ícone de checklist + `12/20`, sem
   marcas e sem glow. Em 100%, mantém o teal e usa ícone de checklist concluído (não vira
   verde de conclusão da barra principal).
3. **Subtasks** — 4 px, sólida, família âmbar, ícone de branch + `N subtasks · X%`, sem
   marcas e sem glow.

**Por quê:** altura e intensidade decrescentes deixam claro qual é o indicador principal;
as famílias de cor não coincidem com a principal nem entre si. A ordem fixa evita "pulo" de
layout conforme os dados chegam.

**Alternativas descartadas:**

- *Barras empilhadas em uma única barra segmentada:* misturaria três métricas sem rótulo
  e quebraria a leitura do progresso.
- *Barras lado a lado:* pouca largura no card de ~292 px e rótulos ilegíveis.

### 5. `ProgressBar` ganha tom, não um componente novo

**Escolhido:** adicionar `tone?: 'default' | 'checklist' | 'subtasks'` (opcional, padrão
`default`) ao `ProgressBar`, mapeado para classes `progress-meter--checklist` e
`progress-meter--subtasks`. As barras secundárias usam `aria-label` próprio e
`data-progress-tone` para testes. O trilho e a transição continuam compartilhados.

**Por quê:** mantém a barra como componente único do produto e garante que
`prefers-reduced-motion`, cantos e acessibilidade valham para as três.

### 6. Novo texto em pt-BR, en e es

Chaves novas: `progressChecklistLabel`, `progressChecklistValue`,
`progressSubtasksLabel`, `progressSubtasksValue` e `progressSubtasksCount` no namespace
`board`. O mockup em `mockups/card-progresso-tres-barras.svg` é a referência visual desta
change (não é asset de produção).

## Risks / Trade-offs

- **Percentuais oficiais caem em itens com checklist** → mudança intencional, registrada no
  CHANGELOG e coberta por testes; a barra de checklist preserva a leitura do andamento real.
- **Card fica mais alto com três barras** → as secundárias só aparecem quando há dado e têm
  4 px, sem rótulos em linha própria; o rodapé e as etiquetas não mudam de posição relativa.
- **Filhos filtrados reduzem a amostra da barra de subtasks** → o helper ignora itens já
  removidos da população e esconde a barra quando não sobra subtask válida.
- **Story virtual muda de id** → o helper normaliza o prefixo `story-virtual-` antes de
  agrupar; teste cobre o caso.
- **Muitos itens no projeto** → o agrupamento é O(n) uma vez por render do board, no mesmo
  nível de custo dos mapas de `isLeaf`/`childrenCount` já existentes.

## Migration Plan

1. Alterar o resolver no domínio e ajustar os chamadores; rodar testes de progresso.
2. Adicionar o helper de subtasks e as props do card; renderizar as barras.
3. Adicionar tokens/classes e textos i18n.
4. Validar visualmente com o mockup e com o board real (densidades confortável e compacta,
   temas claro e escuro).
5. Rollback: reverter o commit; não há dado, schema ou contrato a desfazer.

## Open Questions

Nenhuma pendente. As decisões de comportamento (checklist fora do progresso, subtasks pela
média de avanço, presença em qualquer card com filhos) foram confirmadas pelo usuário.
