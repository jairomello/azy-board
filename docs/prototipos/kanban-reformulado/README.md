# Protótipo de cards do Kanban

Protótipo estático e leve do quadro do Azyboard, feito apenas com HTML e CSS. Abra `index.html` no navegador. O controle **Tema** alterna entre as versões clara e escura sem JavaScript.

## Estrutura compatível

- O quadro segue o shell do `AppShell`, com navegação lateral, cabeçalho e área de trabalho.
- Cada coluna usa largura de 292 px, como `SortableColumn` em `BoardColumns.tsx`.
- Cada `.kanban-card` separa `.kanban-card-grip` do `.kanban-card-content`, seguindo `KanbanCard.tsx`.
- A ordem do conteúdo é `.kanban-card-topo` → `.kanban-card-breadcrumb` → `.kanban-card-title` → etiquetas/tipo → progresso opcional → `.kanban-card-footer`.
- Os dados ilustrativos cobrem código, ícone/cor, ancestrais, título, tags, tipo, progresso, prioridade, pontos, filhos, responsável/agente e status.
- Estados de interação demonstrados no CSS: foco/hover revela copiar, arquivar e excluir; destaque do card em foco; `cursor: grab` no grip.

## Direção visual

As referências `gemini-svg-light.svg` e `gemini-svg-dark.svg` inspiram o fundo com leve matiz, contorno multicolorido, brilho difuso e elevação. A intensidade é reduzida para caber em um quadro com muitos cards e preservar contraste. Os dados e controles são demonstrativos: o protótipo não conecta ao backend, não arrasta, não edita e não executa as ações dos botões.
