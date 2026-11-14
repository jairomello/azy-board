# Proposal

## Why

Com a moldura de 4 px, o header passou a avançar apenas 4 px sobre a coluna da sidebar, mas o canto superior direito da sidebar tem raio de 16 px. A diferença expõe um vão de 12 px do fundo do canvas entre a curva da sidebar e a borda esquerda do header, visível como uma falha clara no encontro das duas superfícies.

## What Changes

- Estender o header para trás da curva da sidebar no desktop: `lg:-ml-1` → `lg:-ml-4` (16 px, o raio do canto).
- Compensar o deslocamento com `lg:pl-8` → `lg:pl-11` (44 px), preservando a posição atual do texto e dos controles do header.
- Manter `rounded-l-none`, `border-l-0` e a ordem de camadas (sidebar acima do header).
- Sem mudança de tokens, props, mobile ou layout interno; apenas o encontro sidebar/header.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `integrated-app-shell`: a emenda desktop passa a exigir continuidade visual sem vão de canvas entre a curva da sidebar e o header, com o conteúdo do header na mesma posição.

## Impact

- Frontend: apenas `apps/web/src/components/AppShell.tsx` (offset e padding do header) e o contrato estrutural em `app-shell-layout-contract.test.ts`.
- Baselines de regressão visual precisam ser regeneradas (mudança restrita à faixa superior do encontro).
- Sem alteração de API, schema ou persistência.

## Assumptions

- A opção escolhida é a curva contínua (Option A): o header preenche a área atrás da curva da sidebar, mantendo o canto arredondado.
- O raio do canto permanece 16 px (`rounded-2xl`).
