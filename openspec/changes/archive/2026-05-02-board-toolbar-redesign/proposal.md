## Why

A barra de ferramentas do board acumula mais funções a cada feature entregue (filtro por squad sendo o próximo). O modelo atual usa texto em todos os controles, consumindo espaço horizontal rapidamente. Com a barra atual já quase cheia, novas adições forçarão quebra de linha ou overflow — prejudicando a usabilidade. A solução é estabelecer uma hierarquia visual clara e compacta antes de adicionar mais filtros.

## What Changes

- Toggles de estado (Mostrar subtasks, Histórias no board, Ocultar épicos vazios) tornam-se botões de ícone com tooltip — sem label de texto
- "Expandir tudo" e "Recolher tudo" tornam-se ícones compactos com tooltip
- "Arquivados" perde o label de texto — mantém apenas o ícone existente com tooltip
- Botões de criação ficam mais compactos: labels encurtadas para `+ Épico`, `+ História`, `+ Task`, `+ Bug`
- A barra é dividida em 3 zonas com separadores visuais: **Visualização | Filtros | Ações de conteúdo**
- Um tooltip padronizado (aparece após 500 ms de hover) explica cada ícone

## Capabilities

### New Capabilities
- `toolbar-icon-buttons`: Padrão de botão ícone com tooltip para ações e toggles da toolbar do board

### Modified Capabilities
- `board-filters`: Reorganização visual dos controles de filtro dentro da toolbar redesenhada
- `card-creation-ui`: Labels dos botões de criação encurtadas na toolbar principal

## Impact

- `apps/web/src/components/BoardFilters.tsx` — substituição de texto por ícones nos toggles; adição de tooltip component
- `apps/web/src/pages/BoardPage.tsx` — reorganização da toolbar, separadores e botões de criação compactos
- Nenhuma mudança de API ou lógica de negócio
- Nenhuma nova dependência (ícones já disponíveis via lucide-react; tooltip via shadcn/ui ou implementação própria com CSS)
