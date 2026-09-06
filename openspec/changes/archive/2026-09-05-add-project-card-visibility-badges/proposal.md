## Why

Com os sinalizadores "Restrito" e "Oculto" (change `add-project-visibility-toggles`), a tela de projetos passa a exibir cards que fogem do padrão: um projeto oculto só aparece porque o usuário ligou a preferência "mostrar projetos ocultos", e um projeto restrito tem um público deliberadamente menor. Sem sinalização visual, um card oculto passa a ser indistinguível de um card comum — o usuário esquece que a preferência está ligada e pode tratar como abandonado um projeto que ele mesmo escondeu —, e um card restrito não comunica que o resto do workspace não o enxerga.

## What Changes

- Adiciona um componente de **badge de visibilidade** com ícone e texto, usado nos cards da tela de projetos:
  - **Restrito**: badge com ícone de cadeado e texto "Restrito", em tom âmbar, com tooltip explicando que só membros e o gerente visualizam o projeto.
  - **Oculto**: badge com ícone de olho cortado e texto "Oculto", em tom neutro, com tooltip explicando que o projeto está fora da listagem padrão.
- Aplica **tratamento visual no card oculto**: borda tracejada e opacidade reduzida, restauradas no hover e no foco, reforçando que ele está fora da listagem padrão.
- Mantém as badges fora do caminho de leitura principal (linha própria, abaixo da descrição), preservando o layout dos cards sem sinalização.
- Remove de `add-project-visibility-toggles` os cenários e a tarefa genéricos de "sinalizar cards", que passam a ser de responsabilidade desta change.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities
- `project-visibility`: passa a definir o comportamento e a aparência das sinalizações visuais de "Restrito" e "Oculto" nos cards da tela de projetos (capacidade introduzida pela change `add-project-visibility-toggles`, da qual esta depende).

## Impact

**Frontend (`apps/web`)**
- Novo componente `src/components/ProjectVisibilityBadges.tsx` (badge + tooltip).
- `src/pages/ProjectsPage.tsx`: tipo `Project` com `isRestricted`/`isHidden`, linha de badges no card e classes condicionais de borda/opacidade no card oculto.
- `src/i18n/locales/{pt-BR,en,es}/common.json`: chaves dos rótulos e dos tooltips.

**Dependências**
- Nenhuma nova (usa `lucide-react`, já presente, e o `Tooltip` existente em `src/components/ui/Tooltip.tsx`).

**Contrato de API**
- Nenhum. Esta change apenas consome os campos `isRestricted` e `isHidden` já retornados por `GET /projects`.

**Ordem de arquivamento**
- Esta change SHALL ser arquivada **depois** de `add-project-visibility-toggles`, pois acrescenta requisitos à capacidade `project-visibility` criada por ela.

**Testes**
- Novo contrato de UI no padrão `*contract.test.ts`, cobrindo presença/ausência das badges, ícones, tooltips e o tratamento do card oculto.
