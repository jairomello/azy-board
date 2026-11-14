# Design

## Context

Ver `proposal.md` — Why. Geometria atual em `lg` com a moldura de 4 px:

- sidebar: `x=4` a `x=224`, raio superior direito de 16 px (a curva começa em `x=208`);
- header: `x=220` (offset `-ml-1` de 4 px a partir da coluna), `padding-left: 32px` (`lg:pl-8`), texto em `x=252`;
- sidebar tem `z-40` e o header `z-30`, então a sidebar pinta por cima nos 4 px de sobreposição.

O header só cobre de `x=220` em diante; entre `x=208` e `x=220` o canvas aparece porque a sidebar, por causa da curva, não alcança essa faixa. Antes da moldura compacta o offset era `-ml-3` (12 px), deixando um vão de apenas 4 px, pouco perceptível.

## Goals / Non-Goals

**Goals:**

- Preencher o vão com a superfície do header, mantendo a curva da sidebar.
- Preservar a posição do conteúdo do header.
- Manter z-order, bordas, raios, sombras e mobile.

**Non-Goals:**

- Remover o arredondamento do canto da sidebar (opção descartada pelo usuário).
- Alterar tokens, largura da sidebar ou a moldura de 4 px.

## Decisions

### D1 — Estender o header por 16 px (`lg:-ml-4`)

O offset precisa cobrir o raio do canto (`rounded-2xl` = 16 px): a coluna começa em `x=224`, então `-ml-4` posiciona o header em `x=208`, exatamente onde a curva começa. A sidebar continua acima (`z-40`), de modo que o trecho extra só fica visível na área fora da curva.

Alternativa descartada: `lg:rounded-tr-none` na sidebar (emenda reta), rejeitada pelo usuário por perder o canto arredondado.

### D2 — Compensar o padding do header (`lg:pl-8` → `lg:pl-11`)

`pl-11` = 44 px. Com o header em `x=208`, o texto volta a `x=252`, exatamente onde está hoje. Sem a compensação, breadcrumb, título e controles andariam 12 px para a esquerda.

### D3 — Manter o comportamento em `lg` compacto

Na sidebar compacta (68 px), a coluna começa em `x=72`; com `-ml-4` o header vai a `x=56`, também no início da curva, e o texto fica em `x=100` (mesmo valor atual). A regra é única para os dois estados.

## Risks / Trade-offs

- **[Sombra/borda do header visível sob a curva]** → A sidebar segue por cima e sua borda desenha a curva; conferir claro/escuro e presets.
- **[Regressão no alinhamento do header]** → O par `-ml-4` + `pl-11` é indivisível; validar a posição do texto em 1280 px.
- **[Baselines visuais desatualizadas]** → Regenerar e comparar; a mudança deve afetar apenas a faixa superior da emenda.

## Migration Plan

1. Ajustar as duas classes no header e o contrato estrutural.
2. Rollback: voltar a `lg:-ml-1` e `lg:pl-8`.

## Open Questions

Nenhuma.
