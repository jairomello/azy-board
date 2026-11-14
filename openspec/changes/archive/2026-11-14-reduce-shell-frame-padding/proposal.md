# Proposal

## Why

No desktop, o shell aplica uma moldura de 12 px (`lg:p-3`) entre a sidebar/header e as bordas da janela. O resultado é uma sensação de aplicação "flutuando" dentro de uma margem grande, apontada na imagem de referência. A intenção é aproximar as duas superfícies das bordas sem colá-las, mantendo a composição integrada.

## What Changes

- Reduzir a moldura externa do shell no desktop de 12 px para 4 px — um terço do valor atual — via `lg:p-3` → `lg:p-1`.
- Ajustar a emenda entre sidebar e header de `-ml-3` para `-ml-1`, para que o header continue encostando na sidebar sem invadir a coluna vizinha com a moldura menor.
- Preservar o espaçamento interno atual: distância entre sidebar e conteúdo (`lg:pl-3`), entre header e conteúdo (`mt-3`), paddings internos da sidebar e do header, raios de canto, bordas e sombras.
- Preservar o layout mobile (header e conteúdo com `mx-3`/`mt-3`, drawer com `inset-3`).
- Sem mudança de tokens, API, banco ou contrato de props do `AppShell`.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `integrated-app-shell`: a composição desktop passa a exigir moldura externa compacta (4 px) com a emenda sidebar/header preservada e sem alteração do layout mobile.

## Impact

- Frontend: apenas `apps/web/src/components/AppShell.tsx` (classes utilitárias da moldura e do offset do header).
- Sem alteração de API, schema, permissões ou persistência.
- Testes existentes do shell não verificam valores de espaçamento; a mudança exige conferência visual nas larguras `lg`, `1280px` e mobile.

## Assumptions

- "1/3 do atual" = 4 px, pois o valor de referência é 12 px (`p-3`). `p-1` corresponde a 4 px na escala do Tailwind.
- A imagem marca apenas a moldura externa (topo, esquerda e base da sidebar/header), não o vão entre sidebar e conteúdo; esse vão permanece em 12 px.
- O pedido é específico do desktop; o layout mobile continua como está.
