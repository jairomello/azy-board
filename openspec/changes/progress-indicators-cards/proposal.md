# Proposal

## Why

A barra de avanço dos cards do Kanban é um traço fino de 2 px, sem profundidade e com cor fixa (`primary/60` ou verde), que não acompanha os presets e temas do produto. A tela de projetos também não mostra nenhum progresso: a pessoa precisa abrir cada board para saber como o projeto está. A referência visual enviada mostra cards de projeto com barra, percentual e contagem de entregas — informação que o Azy Board já calcula, mas não expõe nesse nível.

## What Changes

- Criar um componente único e reutilizável de progresso, com trilho, preenchimento em gradiente, cantos arredondados, brilho sutil e marcas de referência, usando exclusivamente tokens do tema atual (claro/escuro e presets).
- Atualizar a barra de avanço dos cards do Board para o novo visual, preservando a semântica atual de avanço no fluxo e o contador de checklist.
- Expor o progresso geral do projeto na listagem de projetos: percentual de avanço, quantidade de entregas concluídas e total, com o mesmo cálculo do Dashboard/Board.
- Adicionar a barra de progresso aos cards da tela de Projetos, com rótulos legíveis e estado de carregamento/erro explícito.
- Respeitar `prefers-reduced-motion`: a animação de preenchimento é opcional e não há movimento contínuo.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `kanban-card-layout`: a região de avanço do card passa a usar o novo indicador visual, theme-aware e acessível.
- `project-management`: a listagem de projetos passa a expor e exibir o progresso geral por projeto.
- `theming`: indicadores de progresso passam a derivar suas cores dos tokens do tema, com contraste legível nos dois modos.

## Impact

- Frontend: `KanbanCard`, `ProjectsPage`, novo componente compartilhado de progresso e i18n.
- API: `GET /projects` passa a aceitar `includeProgress=true` e a devolver um resumo de progresso por projeto.
- Persistência: novo agregado em massa por projeto (SQLite e PostgreSQL) para evitar N+1.
- Sem migração de schema, sem alteração em dados existentes.

## Assumptions

- O percentual do projeto usa o **avanço no fluxo** (média ponderada das folhas pelo peso da coluna), o mesmo indicador do Dashboard e do Board, e não a razão simples `DONE/total`.
- A contagem “x/y entregas” usa folhas `TASK`/`BUG` não arquivadas, excluindo `CANCELLED` e dependências `EXTERNAL`, como no Dashboard.
- Projetos arquivados continuam sem barra; o recorte de arquivados permanece inalterado.
