# Design

## Context

O protótipo é uma página estática com seu próprio shell e variáveis CSS, enquanto a aplicação compõe o Board dentro do `AppShell` existente. `KanbanCard` já separa a alça de arraste do conteúdo e implementa as regiões de dados, mas usa estilos Tailwind diretamente no JSX e cores hardcoded em alguns estados. `BoardColumns` mantém colunas de 292 px, e `BoardScreen` compõe barra de comandos, filtros, contexto/progresso, canvas e visualização Kanban/árvore. O tema global usa `.dark` e presets claros restritos a tokens `--shell-*`.

## Goals / Non-Goals

**Goals:**

- Transportar para o Board real a hierarquia, os gradientes, contornos, sombras e espaçamentos visíveis no protótipo nos temas claro e escuro.
- Reutilizar as funções e os dados que os componentes já recebem, sem mudanças em APIs, modelo de dados ou persistência.
- Manter a identidade visual do Board estável ao trocar os presets claros do shell e respeitar a densidade e a responsividade atuais.

**Non-Goals:**

- Redesenhar sidebar, header global, navegação, página de árvore como uma tela independente ou outras telas do produto.
- Replicar literalmente os seletores `:has()` e o toggle por checkbox do protótipo, que só existem para uma demonstração estática.
- Mudar comportamento de drag-and-drop, permissões, filtros, dados dos cards ou preferências de tema.

## Decisions

### Tokens visuais do Board isolados do shell

Definir propriedades semânticas para canvas, superfície de coluna, superfície/borda/brilho de card, sombra e realces usando o tema efetivo (`:root`/`.dark`). Aplicá-las dentro da área do Board, sem reutilizar `--shell-*` para o conteúdo. Assim os presets claros continuam afetando sidebar e header, enquanto o Board mantém a paleta do protótipo.

Alternativa considerada: copiar os valores hexadecimais do protótipo em classes ou estilos por componente. Isso foi descartado porque criaria variantes duplicadas e cores inadequadas quando o usuário alterna tema ou preset.

### Composição visual alinhada ao protótipo, com shell global atual

Atualizar barra, chips, contexto, canvas e coluna para a mesma linguagem de superfícies e realces, preservando a ordem e os slots de `AppShell`. O quadro Kanban mantém largura de 292 px por coluna e rolagem horizontal no canvas; os controles de topo devem se adaptar aos breakpoints já usados.

Alternativa considerada: substituir o AppShell inteiro pelo shell HTML do protótipo. Isso foi descartado porque a aplicação tem navegação responsiva, identidade de usuário e controles globais que precisam continuar compartilhados pelas páginas.

### Card real mantém a estrutura funcional existente

Aplicar as regiões e dimensões do protótipo ao DOM atual: manter o grip como ativador exclusivo de drag, o conteúdo como área clicável, o título com edição inline, ações com permissão e confirmação, breadcrumb com tooltip, dados condicionais e indicador AI no avatar. Adicionar classes semânticas estáveis quando necessário para aproximar os estilos ao CSS do protótipo, sem duplicar os dados em um componente paralelo.

Alternativa considerada: converter os cards em HTML independente e substituir o `KanbanCard` atual. Isso foi descartado por duplicar lógica de interação e divergir no overlay de drag, modos SIMPLE/HIERARCHICAL e permissões.

### Layout do card responsivo à preferência de densidade

O modo confortável aplica a composição completa do protótipo, incluindo título até duas linhas e breadcrumb. O modo compacto segue o contrato existente: reduz espaços, oculta breadcrumb, limita título a uma linha e mantém tooltip e demais metadados. As mudanças visuais não criam um terceiro estado de densidade.

Alternativa considerada: usar as dimensões de demonstração do protótipo como valores fixos para todos os cartões. Isso foi descartado porque a aplicação suporta densidade compacta e cards com quantidades diferentes de tags e dados.

### Paridade dos estados e acessibilidade

Hover, `focus-within`, foco de teclado, drag ativo, destino de drop, estados não arrastáveis e destaque solicitado pelo agente devem ter tokens próprios e continuar percebidos sem depender apenas de brilho ou movimento. Respeitar `prefers-reduced-motion` ao animar elevação/transição. O overlay de drag deve usar a mesma aparência base do card.

Alternativa considerada: aplicar apenas um efeito hover e confiar nas cores dos ícones. Isso foi descartado porque ações de card, teclado, arraste e modo escuro já fazem parte do produto.

## Risks / Trade-offs

- [Realces suaves podem ficar pouco visíveis em monitores com baixo contraste ou ofuscar conteúdo em colunas densas] → usar valores diferentes por tema, manter sombra curta e validar os quatro cenários de densidade/tema com conteúdo cheio e vazio.
- [Estilos Tailwind atuais podem competir com as novas regras CSS] → centralizar as novas regras em classes do Board e remover/utilizar utilitários conflitantes nos componentes que forem alterados.
- [O estado de arraste usa o mesmo componente fora da coluna] → aplicar os estilos base no elemento raiz do card para preservar aparência também no `DragOverlay`.
- [Presets claros do shell podem ser confundidos com temas do conteúdo] → não alterar `--shell-*`; restringir tokens novos ao Board e validar cada preset claro com conteúdo claro.

## Migration Plan

1. Implementar os tokens semânticos e aplicá-los primeiro ao canvas, cabeçalho de coluna e controles do Board.
2. Aplicar a superfície e estados ao card real, mantendo DOM e interações necessárias; integrar o mesmo estilo ao overlay de arraste.
3. Adaptar os seletores de densidade e responsividade, verificando os modos SIMPLE/HIERARCHICAL e a árvore.
4. Comparar visualmente claro/escuro, presets claros do shell, hover/foco/drag e conteúdo esparso/denso com o protótipo.

Rollback: reverter as classes/tokens visuais introduzidos em cada componente e remover as variáveis CSS do Board; não há migração de dados, preferência nova ou mudança de API para reverter.
