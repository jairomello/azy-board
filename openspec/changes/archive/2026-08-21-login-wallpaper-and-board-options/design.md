## Context

A LoginPage usa `login-wallpaper.jpeg` no fundo da viewport, mas atualmente a imagem aparece sem tratamento e compete com o card. No Board, o painel aberto pelo botão “Filtros” mistura filtros de dados com opções de visualização, incluindo o modo Hierarquia/Abas, subtasks, histórias e expansão/colapso.

## Goals / Non-Goals

**Goals:**

- Aplicar blur forte e overlay escuro somente à camada de wallpaper, mantendo o card e seus painéis nítidos.
- Reforçar a sombra do card para criar separação visual.
- Separar filtros de dados e opções de visualização em dois menus acionados por botões independentes.
- Manter o estado atual de filtros e opções, incluindo `moduleViewMode`, sem alterar persistência ou regras do Board.
- Renomear o fallback textual do cabeçalho de contexto para “Progresso Geral”.

**Non-Goals:**

- Não alterar a imagem original, o conteúdo do formulário ou a autenticação.
- Não mudar endpoints, modelo de dados, filtros client-side ou comportamento do Board.
- Não criar um novo sistema global de menus.

## Decisions

- **Wallpaper:** manter a imagem no wrapper externo da LoginPage e adicionar uma camada pseudo/absoluta com `backdrop-blur` e background escuro. O card fica em uma camada acima com `relative z-10`.
- **Sombra do card:** aumentar a sombra existente no card externo, sem aplicar sombra em cada painel individual.
- **Separação de menus:** manter `BoardFilters` como componente reutilizável, adicionando uma prop para renderizar somente filtros de dados ou somente opções de visualização. `BoardCommandBar` terá estados/ref independentes para `filtersOpen` e `optionsOpen`.
- **Controles de opções:** mover para o menu “Opções” os toggles de subtasks, histórias, Hierarquia/Abas, épicos/histórias vazias e expandir/recolher. O menu “Filtros” manterá Squad, Módulo, Sprint, Responsável, tipos e tags, além de limpar somente filtros de conteúdo.
- **Tradução:** adicionar labels aos três arquivos `board.json`; o fallback “Progresso Geral” também será traduzido para EN e ES.

Alternativa considerada: duplicar o JSX dos controles em `BoardCommandBar`. Foi rejeitada porque criaria duas fontes de verdade para os mesmos filtros e aumentaria o risco de divergência entre desktop e mobile.

## Risks / Trade-offs

- **[Risk]** Dois menus podem ficar abertos simultaneamente. **Mitigation:** o listener de clique externo fechará ambos e abrir um menu fechará o outro.
- **[Risk]** O menu de opções pode ficar alto em telas pequenas. **Mitigation:** aplicar largura responsiva e `max-h` com rolagem vertical.
- **[Risk]** Blur forte pode aumentar custo de pintura em dispositivos móveis. **Mitigation:** aplicar blur somente ao wallpaper, fora do conteúdo interativo, com fallback de overlay escuro.

## Migration Plan

1. Ajustar somente classes/estrutura do frontend e traduções.
2. Validar login nos breakpoints e ambos os menus do Board.
3. Nenhuma migração de dados é necessária; rollback consiste em remover as novas camadas/classes e restaurar o rótulo.

## Open Questions

- Nenhuma. O grau “bem forte” será representado por um blur alto e facilmente ajustável em uma única classe Tailwind.
