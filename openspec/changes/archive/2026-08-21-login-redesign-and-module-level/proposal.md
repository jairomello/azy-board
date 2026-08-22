## Why

A tela de login atual ocupa toda a altura do card com pouco espaço de respiro vertical, o que impede a futura adição de uma imagem de papel de parede no fundo. Além disso, o board exibe a hierarquia Épico >> História >> Cards, mas módulos — que já existem como conceito de agrupamento — não aparecem como nível visual. Adicionar Módulo como nível collapsível acima do Épico (Módulo >> Épico >> História >> Board) dará mais clareza organizacional e permitirá criar módulos diretamente pelo toolbar do board.

## What Changes

- **Login page**: Reduzir a altura vertical do box de login, aumentando as margens superior e inferior para centralizar melhor o formulário no card. Preparar o layout para suportar uma imagem de papel de parede no fundo (sem imagem agora, apenas a estrutura).
- **Board hierarchy**: Adicionar Módulo como nível visual collapsível no board, acima do Épico. A hierarquia renderizada será: Módulo (swimlane) >> Épico (swimlane) >> História (lane) >> Cards.
- **Toolbar create button**: Adicionar opção "+ Módulo" no grupo de botões de criação do toolbar do board, abrindo uma modal de criação de módulo.
- **Module swimlane**: Cada módulo com épicos será renderizado como uma swimlane collapsível de nível superior, agrupando os épicos que lhe pertencem. Módulos sem épicos ficam ocultos no board (gerenciados via Settings).

## Capabilities

### New Capabilities
- `login-layout-redesign`: Redesenho do layout da LoginPage para reduzir altura do box de login e aumentar margens verticais, preparando para papel de parede futuro.
- `module-as-board-level`: Módulo como nível visual collapsível no board, agrupando épicos. Renderização de ModuleSwimlane acima das swimlanes de Épico existentes.

### Modified Capabilities
- `epic-story-ui`: Adicionar botão "+ Módulo" no toolbar do board. Atualizar a hierarquia de renderização para incluir nível de Módulo acima de Épico.
- `card-creation-ui`: Adicionar opção de criação de Módulo no grupo de botões de criação da toolbar.
- `task-hierarchy`: Atualizar breadcrumb para incluir Módulo no caminho hierárquico. Atualizar Leaf Rule para descrever a hierarquia completa com Módulo.

## Impact

- **Frontend**: `apps/web/src/pages/LoginPage.tsx` (layout), `apps/web/src/pages/BoardPage.tsx` (nova renderização de ModuleSwimlane), `apps/web/src/components/BoardCommandBar.tsx` (novo botão), novo componente `ModuleSwimlane.tsx`
- **Tipos**: `packages/types/src/index.ts` — possivelmente ajustar tipos de agrupamento
- **i18n**: Novas chaves de tradução para labels de Módulo no board e botão de criação
- **Specs existentes**: `epic-story-ui`, `card-creation-ui`, `task-hierarchy` receberão deltas
