# Design

## Context

Ver `proposal.md` para a motivação. Hoje o card renderiza:

- `card-label-row` com `flex items-start justify-between gap-2`;
- `card-tags` com `flex flex-wrap gap-1 min-w-0`;
- cada tag como `inline-flex ... text-white` sem `whitespace-nowrap` nem largura máxima;
- status e tipo no mesmo eixo à direita, com `flex-wrap` próprio.

Os nomes `Entrega 02/12` e `Jornada 1` quebram no espaço interno da pílula,
gerando uma tag de duas linhas. O `items-start` alinha o status pelo topo dessa
tag alta, e o `justify-between` comprime o status/tipo. O resultado é o bloco
torto visto em produção.

## Goals / Non-Goals

**Goals:**

- Garantir altura e alinhamento previsíveis para a linha de metadados.
- Impedir quebra de texto dentro de tag, status ou tipo.
- Ter política explícita para excesso de tags e para nomes longos.

**Non-Goals:**

- Não mudar o modelo de tags, cores ou permissões.
- Não criar edição de tag no card.
- Não alterar as barras de progresso desta mesma entrega.

## Decisions

### 1. Duas faixas em vez de uma linha com `justify-between`

**Escolhido:** `card-labels` vira uma coluna (`flex flex-col gap-1.5`) com duas
faixas: tags e estado. As tags vêm primeiro (contexto), status/tipo depois
(estado atual).

**Por quê:** separa responsabilidades e remove a competição por largura. A
faixa de tags pode usar toda a largura do card; a de estado fica estável mesmo
quando existem muitas tags.

**Alternativa descartada:** manter uma única linha com grid
`minmax(0,1fr) auto`. É mais compacta, mas obriga a limitar as tags a uma ou
duas e ainda deixa o status comprimido em cards estreitos.

### 2. Tags em linha única com truncamento e `+N`

**Escolhido:** a faixa de tags é `flex items-center gap-1 overflow-hidden`
(sem `flex-wrap`). Cada tag tem `h-5`, `max-w-[8.5rem]`, `shrink-0`,
`whitespace-nowrap`; o texto interno usa `truncate` e `title` com o nome
completo. No máximo duas tags visíveis; o restante vira `+N` com tooltip e
`aria-label`.

**Por quê:** uma tag nunca pode alterar a altura da linha. O `+N` mantém a
informação acessível sem transformar o card em uma parede de etiquetas.

**Alternativa descartada:** `flex-wrap` com limite de altura — ainda cria
linhas de alturas diferentes e volta a desalinhar o status.

### 3. Pílula com fundo tênue + ponto colorido

**Escolhido:** no card, a tag usa
`color-mix(in srgb, var(--tag-color) 16%, transparent)` no fundo,
`color-mix(in srgb, var(--tag-color) 80%, hsl(var(--foreground)))` no texto e um
ponto sólido com a cor original. O nome da cor vem de `tag.color`.

**Por quê:** o bloco sólido saturado fazia a tag dominar o card e criava
contraste irregular. O fundo tênue mantém a identidade da cor e deixa o texto
legível nos dois temas, sem depender de branco fixo.

**Alternativa descartada:** manter pílula sólida e apenas truncar. Resolveria a
quebra, mas o peso visual continuaria desproporcional em nomes longos.

### 4. Status e tipo em faixa própria, sem `flex-wrap`

**Escolhido:** `card-type-status` fica em `flex items-center gap-1` (sem
`justify-end` e sem `flex-wrap`), com chips `h-5 whitespace-nowrap shrink-0`.
Quando faltar espaço, o texto trunca; o chip não desce de linha.

**Por quê:** status e tipo são atributos de estado, não etiquetas de conteúdo.
Precisam de posição previsível para o olho encontrar o estágio do card.

## Risks / Trade-offs

- **Teto de duas tags pode esconder informação** → `+N` com tooltip e
  `aria-label` lista as ocultas; o modal continua mostrando todas.
- **Nome longo truncado no card** → tooltip nativo e modal preservam o nome
  completo; a truncagem é só visual.
- **Pílulas mais leves podem reduzir a percepção de cor da tag** → o ponto
  colorido e o fundo tingido mantêm a cor visível sem o bloco saturado.
- **Tooltip nativo não aparece no toque** → o modal é o fallback; o `+N` tem
  nome acessível para leitores de tela.

## Migration Plan

1. Trocar o markup da linha de etiquetas no `KanbanCard`.
2. Ajustar classes/CSS da pílula e do `+N`.
3. Atualizar testes de contrato e componente.
4. Conferir claro/escuro e confortável/compacto contra o mockup.
5. Rollback: reverter o commit; sem dados ou contrato envolvidos.
