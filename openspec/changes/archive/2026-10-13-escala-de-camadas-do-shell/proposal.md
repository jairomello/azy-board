# Proposal

## Why

No board, o menu do perfil abre parcialmente escondido atrás da command bar (`Confortável` / `🗑` / `+ Criar`): os itens de cima ficam cobertos e não podem ser lidos nem clicados. O mesmo vale para os outros popovers do header (idioma e tema), porque todos ficam presos no contexto de empilhamento do header.

Causa observada no `AppShell`: o header é `relative z-10` e o wrapper da `commandBar` na workspace é `relative z-30`. São **irmãos no mesmo contexto de empilhamento**, então a command bar pinta sobre o header inteiro — e os menus internos do header (`z-50` dentro dele) não têm como escapar desse contexto. O próprio comentário do código declara a intenção contrária ("z-10 mantém o header (e menus internos, como o do perfil) acima da workspace"), ou seja, a intenção e o valor efetivo divergiram quando a command bar subiu para `z-30`.

Hoje o único consumidor do slot `commandBar` é o board (`BoardScreen`), então o defeito se manifesta lá, mas a causa é do shell e afeta qualquer página que venha a usar o slot.

## What Changes

- Estabelecer uma **escala explícita de camadas do shell**, documentada no código, e ajustar os valores para que a ordem de pintura seja: conteúdo da workspace (auto) → command bar → header e seus popovers → overlays globais (modais, drawer mobile) → avisos transitórios.
- Preservar a relação atual entre sidebar e header (a sidebar continua acima do header, mantendo a emenda visual já existente entre os dois).
- Corrigir de uma vez os três popovers internos do header — perfil, idioma e tema — sem alterar o código de cada um.
- Atualizar o contrato estrutural `apps/web/src/app-shell-layout-contract.test.ts`, que hoje fixa os valores antigos de z-index do header, da sidebar e da command bar.

**Fora de escopo (decidido com o usuário):** auditar e normalizar os demais z-index ad hoc fora do shell (tooltip de card, checklist, editor rico, toast).

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `integrated-app-shell`: novo requisito de ordem de empilhamento das camadas do shell — o header e seus popovers SHALL pintar acima dos slots da workspace (command bar) e do conteúdo da página, e abaixo dos overlays globais; a composição visual entre sidebar e header permanece inalterada.

## Impact

**Web**
- `apps/web/src/components/AppShell.tsx`: valores de z-index do header, da sidebar e do wrapper da `commandBar`, mais o comentário que documenta a escala.
- `apps/web/src/app-shell-layout-contract.test.ts`: contrato estrutural que verifica os valores atuais.
- `apps/web/src/components/ProfileDropdown.tsx`, `LanguageSelector.tsx` e `ThemeToggle.tsx`: sem alteração de código — passam a herdar a correção pelo contexto de empilhamento do header. A verificação é observar que os popovers deixam de ser cobertos.
- `apps/web/src/features/board/components/BoardCommandBar.tsx`: sem alteração; seus popovers internos continuam acima do conteúdo do board.

**Sem impacto**
- Nenhuma mudança de API, contrato HTTP, banco, migrations ou i18n.
- Nenhuma mudança de comportamento funcional: apenas a ordem de pintura.
