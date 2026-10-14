# Design

## Context

Ver `proposal.md` — Why. O que o código atual impõe ao desenho:

- `AppShell` tem um único contêiner de grid com quatro participantes que podem se sobrepor: `header` (`relative z-10`), `aside[data-shell-sidebar]` (`relative z-20`), e o wrapper da `commandBar` (`relative z-30 ... backdrop-blur-xl`) dentro de `div[data-shell-workspace]`.
- `data-shell-workspace` **não** é contexto de empilhamento (sem `position`, `z-index`, `filter` ou `transform`), então o `z-30` da command bar compete direto com o `z-10` do header. Vence a command bar.
- O header **é** contexto de empilhamento (posicionado com `z-index`), então os popovers que ele hospeda (`ProfileDropdown` usa `z-50`, e os de idioma e tema seguem o mesmo padrão) ficam presos dentro dele e não conseguem escapar.
- Camadas globais já existentes: modais e o drawer mobile usam `z-50`; o toast usa `z-[200]`; o editor rico `z-[100]`; a checklist `z-[90]`; o tooltip de card `z-[9999]`.
- `apps/web/src/app-shell-layout-contract.test.ts` fixa literalmente os valores atuais (`'shell-surface relative z-10'`, `'relative z-20 hidden lg:block'`, `'relative z-30'`), então ele muda junto.
- A spec `integrated-app-shell` já exige que a workspace, incluindo o slot `commandBar`, apareça "abaixo do header" e "sem sobreposição". O defeito é uma violação dessa exigência, não uma funcionalidade nova.
- Hoje apenas `BoardScreen` fornece `commandBar`.

## Goals / Non-Goals

**Goals:**

- Tornar a ordem de empilhamento do shell explícita e correta: o header e seus popovers acima da workspace; os overlays globais acima de tudo.
- Preservar a composição visual atual entre sidebar e header.
- Garantir que os popovers da própria command bar continuem acima do conteúdo do board.

**Non-Goals:**

- Normalizar os z-index fora do shell (decisão de escopo já tomada com o usuário).
- Trocar a implementação dos popovers por portal, ou repensar posicionamento/click-outside.
- Alterar props públicas do `AppShell`, tokens de tema ou o layout do grid.

## Decisions

**1. Escala explícita: conteúdo (auto) < command bar `z-20` < header `z-30` < sidebar `z-40` < overlays globais `z-50+`.**

Cada degrau sobe um nível, e todos permanecem abaixo do `z-50` já usado por modais e drawer mobile, de modo que nenhuma camada global muda de comportamento. O que corrige o defeito é o header passar a ficar **acima** da command bar; a sidebar sobe para `z-40` apenas para manter a relação que já existia (antes `z-20` sobre `z-10`).

- *Alternativa rejeitada*: renderizar o menu do perfil em portal no `body`. Escapa do contexto do header sem mexer na escala, mas corrige só um dos três popovers do header e adiciona complexidade de posicionamento e click-outside para resolver um problema que é de escala.
- *Alternativa rejeitada*: baixar a command bar para `z-0`/auto. `z-index: 0` e os elementos posicionados com `z-index: auto` do conteúdo (as colunas do board) caem no **mesmo passo** de pintura, resolvidos por ordem no DOM — e `main` vem depois da command bar, o que empurraria os popovers de filtros/opções/criar para baixo das colunas.
- *Alternativa rejeitada*: manter o header em `z-10` e encaixar a command bar num valor entre 0 e 10. Mesma razão do item anterior e a ordem continuaria implícita.

**2. A sidebar permanece acima do header (`z-40`).**

O header tem `lg:-ml-3` e `lg:rounded-l-none` para emendar visualmente na sidebar, e hoje é a sidebar que pinta por cima desses 12px. Manter a relação evita mudar sombra/borda/canto da emenda.

**3. A escala fica local ao `AppShell`, expressa nos valores das classes e num comentário.**

O `AppShell` é o único lugar que decide a ordem entre header, workspace e sidebar; não há ganho em criar variáveis de escala globais enquanto os demais z-index do app seguem ad hoc (fora de escopo).

**4. Ancorar a escala no contrato estrutural.**

`app-shell-layout-contract.test.ts` passa a fixar os novos valores. Foi exatamente a divergência silenciosa entre o comentário ("header acima da workspace") e o valor efetivo (`z-10` vs `z-30`) que produziu o defeito; o contrato impede que isso se repita sem intenção explícita.

## Risks / Trade-offs

- **[Sombra do header sobre a sidebar]** Subir o header pode deixar sua sombra visível sobre a borda direita da sidebar se a sidebar não subir junto. → Mitigação: subir a sidebar para `z-40` (decisão 2) e conferir a emenda nas larguras `lg` e `≥1280px`.
- **[Popovers da command bar sob o board]** Se a camada da command bar ficar abaixo do conteúdo posicionado de `main`, filtros/opções/criar seriam cobertos. → Mitigação: manter a command bar com z-index positivo acima de `main`, com cenário na spec e conferência manual no board.
- **[Contrato estrutural]** `app-shell-layout-contract.test.ts` casa strings de classe literais. → Mitigação: atualizar o contrato na mesma tarefa da mudança do componente.
- **[Cobertura parcial dos popovers]** Idioma e tema vivem no mesmo contexto de empilhamento do perfil; se algum tiver um contêiner próprio com z-index, a correção poderia não alcançá-lo. → Mitigação: conferir os três popovers numa página com `commandBar` (cenário na spec).
- **[Regressão visual mobile]** Abaixo de `lg` o layout é `flex flex-col` (header e depois workspace); a nova ordem precisa valer também nesse arranjo. → Mitigação: mesma correção vale para os dois arranjos, pois a comparação é entre irmãos; conferir no mobile.

## Migration Plan

- Mudança apenas de web (CSS/classe + contrato de teste). Sem banco, sem API, sem migration, sem i18n.
- Rollout: publicar a imagem web normalmente; rollback é voltar a tag anterior, e nada depende dos valores.
- Verificação: `bun test apps/web/src/app-shell-layout-contract.test.ts`, `bun run --cwd apps/web typecheck`, `bun run check` e conferência manual no board (menu do perfil, idioma e tema abertos com a command bar visível; popovers da própria command bar sobre as colunas).

## Open Questions

Nenhuma.
