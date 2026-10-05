## Context

O `KanbanCard` (`apps/web/src/components/KanbanCard.tsx`) é o card usado por boards SIMPLE e HIERARCHICAL. Hoje ele organiza o conteúdo em um bloco único: ícone + breadcrumb na primeira linha, tipo + UUID truncado na segunda, título, tags, progresso de checklist e rodapé com badge de tipo (repetido), prioridade, pontos, indicador de filhos e avatar. As ações (copiar referência, arquivar, excluir) são um overlay `absolute` no canto superior direito, visível apenas em hover de mouse (`group-hover`), sem área reservada — podendo cobrir o conteúdo — e sem acesso equivalente por teclado.

O card T32 aprovou o estudo **01 — Essencial** (`docs/prototipos/cards-t32/01-essencial.svg`), cuja especificação JSON e referência CSS comentada constam na descrição do card no board. A coluna tem 292 px; os tokens de cor vêm de `apps/web/src/styles/globals.css` (`--card`, `--border`, `--ring`, `--status-*`). O dnd-kit restringe os listeners de arraste à alça (`setActivatorNodeRef`), e o tooltip do breadcrumb já é renderizado via portal para evitar clipping durante o arraste.

Restrições relevantes: sem mudanças de backend/API; `CardData` já expõe todos os campos necessários; testes de frontend incluem guardas estruturais com marcador `[CONTRATO-ESTRUTURAL]` (verificados por `check:frontend-tests`); i18n obrigatório em PT-BR, EN e ES para qualquer rótulo novo; licenças apenas MIT/Apache/BSD/ISC/Domínio público (nenhuma dependência nova será adicionada).

**Board ref:** `94cadbe5-42ec-4748-a1b3-2802715148a4`.

## Goals / Non-Goals

**Goals:**

- Implementar a hierarquia visual da proposta 01 — Essencial nos estados normal e hover/foco, dentro da coluna de 292 px.
- Tornar a estrutura previsível: topo (alça › ícone › código › ações), breadcrumb, título, etiquetas (tags + tipo), progresso opcional e rodapé com divisor.
- Garantir acessibilidade das ações (hover **e** foco por teclado, nomes acessíveis, foco visível) sem bloquear arraste, abertura de detalhes ou edição inline.
- Omitir metadados ausentes sem inventar conteúdo (fim do UUID truncado) e permitir que tags múltiplas expandam o card de forma controlada.
- Preservar compatibilidade com tema claro/escuro, densidade compacta, boards SIMPLE e HIERARCHICAL e os comportamentos atuais (arraste, detalhes, edição inline, indicadores de status).

**Non-Goals:**

- Não altera backend, API, contratos de tipos (`@azy-board/ui-contracts`, `@azy-board/domain`) nem modelo de dados.
- Não altera as propostas 02 e 03 do estudo visual (registradas como alternativas não escolhidas).
- Não muda regras de permissão, fluxo de exclusão/arquivamento nem o formato da referência copiada (`formatCardReference`).
- Não redesign do modal de detalhes do item nem das colunas/swimlanes do board.
- Não introduz dependências novas.

## Decisions

### D1 — Reestruturar o JSX do `KanbanCard` em regiões nomeadas (sem extrair subcomponentes novos)

O card será reescrito em regiões na ordem da especificação JSON: raiz → topo (`grid` de 3 colunas: 23 px / minmax(0, 1fr) / 84 px) → contexto (breadcrumb) → título → etiquetas → progresso opcional → rodapé com divisor. Classes utilitárias Tailwind + os tokens existentes traduzem a referência CSS comentada do card; nomes como `kanban-card__*` são sugestão e podem ser adaptados ao JSX atual.

- *Por quê:* mantém o componente único (evita prop-drilling de callbacks de ação e o acoplamento com `useSortable`) e a mudança é local e revisável em um arquivo.
- *Alternativa considerada:* extrair subcomponentes (`CardHeader`, `CardFooter`). Rejeitada por agora: aumenta a superfície de regressão sem necessidade funcional; pode ser feita depois se o componente voltar a crescer (ele já passou por modularização em mudanças anteriores).

### D2 — Área de ações reservada no grid do topo, visível em hover **e** `focus-within`

As ações deixam de ser overlay `absolute` e passam a ocupar a terceira coluna do grid do topo (largura reservada ~84 px, botões de 26 px, gap 2 px). Visibilidade: `opacity-0 group-hover:opacity-100` **+** `group-focus-within:opacity-100` (e `pointer-events` coerentes). Ordem fixa: copiar referência → arquivar → excluir; `stopPropagation` em todos; exclusão mantém `window.confirm`.

- *Por quê:* área reservada garante que as ações nunca cubram ícone, código, breadcrumb, título ou tags, e o estado de foco por teclado torna as ações operáveis sem mouse (critério de aceite do T32).
- *Alternativa considerada:* manter overlay absoluto com `focus-within`. Rejeitada: sobreposição é exatamente o problema a resolver e a área reservada é parte da spec aprovada.

### D3 — Código curto no topo; UUID truncado removido

O `sequenceCode` passa a ser exibido na linha de topo, ao lado do ícone (`font-mono`, truncável com `min-w-0`). Quando não há código, nada é renderizado nesse slot — não há mais fallback para `card.id.slice(0, 8)`. A referência copiada continua via `formatCardReference`, que decide seu próprio formato (fora do escopo).

- *Por quê:* o card T32 determina "não inventar conteúdo"; o UUID abreviado não era uma referência utilizável e a numeração `T#/B#` já é o padrão do produto.
- *Alternativa considerada:* manter UUID como fallback. Rejeitada: contraria a decisão registrada no estudo visual e polui o topo.

### D4 — Breadcrumb acima do título, reaproveitando portal de tooltip

O breadcrumb ocupa linha própria entre o topo e o título, com `truncate` (largura disponível) e o tooltip existente via `createPortal` mostrando o caminho completo (o tooltip atual já atende; ajustar apenas gatilhos de foco/teclado se necessário).

- *Por quê:* atende à especificação ("posicao: acima do titulo") e resolve as duas specs existentes que diziam "abaixo do título" via deltas (`card-management`, `task-hierarchy`).
- *Alternativa considerada:* breadcrumb dentro da linha de topo junto ao ícone. Rejeitada: em hierarquias longas competiria com código e ações pelos 292 px.

### D5 — Etiquetas: tags à esquerda com quebra, tipo textual único à direita

Linha própria com `flex` e `justify-between`: container de tags com `flex-wrap` e `min-w-0` (quebra de linha aumenta a altura do card), e a etiqueta de tipo (`Tarefa/Bug/…`, reutilizando `TYPE_STYLES` e chaves i18n existentes) fixa à direita. O badge de tipo é removido do rodapé (tipo aparece uma vez).

- *Por quê:* elimina a duplicação atual do tipo e dá posição previsível a ambos (decisões comuns do README do estudo).
- *Alternativa considerada:* tipo como ícone+cor. Rejeitada: o estudo determina tipo sempre por texto e cor.

### D6 — Rodapé com divisor e renderização condicional por campo

Rodapé separado por `border-top` sutil (token `--border`), exibindo apenas campos presentes, em ordem fixa: prioridade → pontos → subtarefas (`GitBranch` + contagem) → avatar do responsável alinhado ao fim (`margin-left: auto`). O indicador de filhos mantém o requisito de `card-footer-children-indicator` (ícone + número, tooltip).

- *Por quê:* "omitir sem reservar espaço" evita vazios e mantém posições previsíveis para os presentes.

### D7 — Faixa de status e densidade compacta preservados via classes/tokens existentes

A faixa lateral de 3 px continua o `border-l-[3px]` mapeado por `STATUS_INDICATOR` (cor = status, não tipo/ícone). A densidade compacta (feature existente do board) continua aplicando suas classes de escala; a nova estrutura usa espaçamentos compatíveis (`gap`/`py`) sem tokens novos.

- *Por quê:* comportamento atual a preservar, explícito nos critérios de aceite.
- *Alternativa considerada:* element `::before` para a faixa. Rejeitada: mudaria a mecânica que já funciona e está coberta por testes.

### D8 — Verificação por verificações estruturais + smoke, sem snapshot visual novo

A validação usará `bun run check` (typecheck + lint + testes + build), `bun run test:smoke` e ajustes nos testes que dependem da estrutura antiga (guardas `[CONTRATO-ESTRUTURAL]` do `check:frontend-tests` atualizadas para a nova hierarquia de regiões, quando aplicável). Não será introduzido teste de screenshot neste escopo.

- *Por quê:* o projeto já tem esse padrão de verificação; screenshot testing exigiria infraestrutura nova (fora do escopo e da política de dependências).

## Risks / Trade-offs

- **[Regressão em testes que acoplam ao DOM antigo] →** mapear antes de codar com `grep` por `KanbanCard`, breadcrumbs e UUID nos testes; atualizar guardas com o marcador `[CONTRATO-ESTRUTURAL]` e rodar `check:frontend-tests`.
- **[Altura variável com tags quebrando linha altera densidade percebida das colunas] →** quebra é permitida e controlada (`flex-wrap` + `min-w-0`); validar com board real de exemplo e, se necessário, limitar a altura visível das tags com expansão por linha única adicional (decisão de ajuste fino na implementação, sem mudar a spec).
- **[Área reservada de 84 px reduz espaço útil em cards sem ações (ex.: VIEWER)] →** quando nenhum callback de ação é fornecido, a coluna reservada colapsa para `w-0`/`auto` mantendo o alinhamento — o reservado é para os cards com ações; especificar no código que o slot é condicional à presença de handlers.
- **[Tooltip do breadcrumb pode ser clipado durante arraste] →** manter o portal já existente em `document.body` e revalidar o comportamento arrastando o card.
- **[Perda de acessibilidade se ações só aparecerem em hover] →** `focus-within` + `focus-visible` com `outline` (`--ring`) nos botões; validar navegação por Tab no board.
- **[Divergência visual entre implementação e SVG] →** conferir os dois estados do segundo card do SVG (normal/hover) lado a lado durante o desenvolvimento; o SVG é a referência de hierarquia, não de pixel.

## Migration Plan

Mudança puramente de frontend, deploy junto ao release normal (`v1.0.0` em dev). Sem migração de dados. Rollback: reverter o commit do `KanbanCard` (arquivo único + testes) restaura o layout anterior; nenhuma flag de feature é necessária.

## Open Questions

- Nenhuma bloqueante. Ajustes finos de espaçamento/tipografia durante a implementação devem seguir os tokens existentes e o SVG; dúvidas visuais voltam ao usuário antes de inventar padrão novo.
