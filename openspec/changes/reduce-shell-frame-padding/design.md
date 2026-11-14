# Design

## Context

Ver `proposal.md` — Why. O `AppShell` (`apps/web/src/components/AppShell.tsx`) define a moldura em três pontos acoplados:

- `data-shell-layout`: `lg:p-3` (12 px em todos os lados) cria o vão entre as superfícies e as bordas da janela.
- `header`: `lg:-ml-3` puxa o header 12 px para a esquerda, sobre a coluna da sidebar, para que ele encoste nela e forme a composição contínua; `lg:pl-8` compensa o deslocamento e mantém o texto do header na posição atual.
- `data-shell-workspace`: `lg:pl-3` mantém 12 px entre a sidebar e o conteúdo; `commandBar`/`main` usam `lg:mx-0` e `mt-3` internos.

No mobile, header e conteúdo usam `mx-3`/`mt-3` e o drawer usa `inset-3`; esses valores são independentes da moldura desktop.

## Goals / Non-Goals

**Goals:**

- Moldura desktop de 4 px (1/3 de 12 px), mantendo as superfícies destacadas das bordas.
- Emenda sidebar/header intacta: sem vão, sem sobreposição indevida.
- Nenhuma mudança nos vãos internos, raios, bordas, sombras, tokens ou props.

**Non-Goals:**

- Alterar o layout mobile.
- Reduzir o vão sidebar↔conteúdo ou header↔conteúdo.
- Redesenhar cantos, sombras ou a geometria da sidebar.

## Decisions

### D1 — Trocar `lg:p-3` por `lg:p-1`

`p-1` = 4 px na escala do Tailwind, exatamente um terço de `p-3` (12 px). Alternativas descartadas:

- **Token CSS dedicado** (`--shell-frame: 4px`): mais flexível, porém cria infraestrutura para um valor único e sem reuso; a classe utilitária é o padrão do componente.
- **Valor arbitrário `lg:p-[4px]`**: equivalente, mas menos legível que `p-1`.

### D2 — Ajustar o offset do header para `-ml-1`

O offset precisa acompanhar a moldura: com `p-1`, a borda direita da sidebar fica 8 px à esquerda de onde estava. Manter `-ml-3` faria o header invadir a sidebar; `-ml-1` (4 px) preserva a emenda exata e o `lg:pl-8` continua posicionando o texto do header como hoje.

### D3 — Preservar vãos internos e mobile

Somente as classes da moldura (`lg:p-3` → `lg:p-1`) e do offset (`lg:-ml-3` → `lg:-ml-1`) mudam. `lg:pl-3`, `mt-3`, `mx-3`, `inset-3`, paddings internos e raios ficam como estão, porque a imagem marca apenas a moldura externa.

## Risks / Trade-offs

- **[Sombra do header/sidebar mais próxima da borda pode parecer cortada]** → Conferir claro/escuro e presets com a moldura de 4 px; se necessário, apenas documentar como aceitável, sem mexer nas sombras nesta change.
- **[Cantos de 16 px (`rounded-2xl`) com moldura de 4 px parecem proporcionalmente maiores]** → Verificar visualmente; reduzir raio seria outra decisão de design, fora do pedido.
- **[Header desalinhado se apenas a moldura mudar]** → O par `p-1` + `-ml-1` é indivisível; a tarefa inclui os dois na mesma alteração.
- **[Regressão em larguras próximas do breakpoint `lg`]** → Conferir 1024 px, 1279 px, 1280 px e 1440 px, e o mobile logo abaixo de 1024 px.

## Migration Plan

1. Ajustar as duas classes no `AppShell`; nenhum dado ou contrato muda.
2. Rollback: reverter as classes para `lg:p-3` e `lg:-ml-3`.

## Open Questions

Nenhuma pendência que altere specs, abordagem ou tarefas.
