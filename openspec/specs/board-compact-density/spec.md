## Purpose

Definir uma preferência única de densidade do Board que, ao ser acionada, compacta o cabeçalho e os cards preservando informações, controles e acessibilidade.

## Requirements

### Requirement: Densidade do Board controla cabeçalho e cards
O Board SHALL ter uma única preferência de densidade acionada pelo controle existente de densidade, com dois estados: **Confortável** (padrão, layout atual) e **Compacta**. O estado Compacta SHALL aplicar, no mesmo acionamento, o cabeçalho super compacto e a compactação dos cards do Board. O toggle SHALL ter estado acessível (`aria-pressed`) e rótulo traduzido em PT-BR, EN e ES.

#### Scenario: Padrão preservado
- **WHEN** usuário abre o Board sem ter alterado a densidade
- **THEN** o cabeçalho e os cards são exibidos no layout Confortável atual

#### Scenario: Acionar densidade compacta
- **WHEN** usuário alterna o controle de densidade para Compacta
- **THEN** o cabeçalho passa ao modo super compacto e os cards ficam visualmente mais densos no mesmo acionamento

#### Scenario: Retornar a Confortável
- **WHEN** usuário alterna novamente para Confortável
- **THEN** o cabeçalho e os cards retornam ao layout completo, preservando filtros e visualização

### Requirement: Compactação efetiva dos cards
No estado Compacta, o sistema SHALL compactar os cards para uma visualização mais densa: reduzir o espaçamento vertical interno (preenchimento e distância entre regiões), limitar o título a uma linha e ocultar o breadcrumb. O texto completo do título SHALL permanecer acessível por tooltip. O estado Compacta SHALL NOT remover as demais regiões do card (topo com alça/ícone/código, etiquetas, progresso de checklist e rodapé) nem os controles, e SHALL NOT alterar o estado Confortável.

#### Scenario: Cards visivelmente mais densos
- **WHEN** o Board está em Compacta
- **THEN** os cards exibem menos altura por card do que em Confortável, com o título em uma linha e o breadcrumb oculto, mantendo topo, etiquetas, progresso e rodapé visíveis

#### Scenario: Título completo acessível
- **WHEN** o título é truncado em uma linha no modo Compacta
- **THEN** o texto completo fica disponível por tooltip ao passar o mouse sobre o título, e a edição inline continua funcionando

#### Scenario: Confortável restaura o layout completo
- **WHEN** o usuário retorna de Compacta para Confortável
- **THEN** o breadcrumb volta a ser exibido e o título volta a ocupar até duas linhas

#### Scenario: Efeito perceptível em relação ao estado anterior
- **WHEN** o usuário alterna entre Confortável e Compacta com cards exibidos
- **THEN** a área de cards muda de densidade de forma perceptível na tela, sem perder informação além do breadcrumb e do truncamento do título

### Requirement: Layout do cabeçalho no modo compacto
No estado Compacta, o Board SHALL reduzir a altura e as margens da barra de controles, substituir o painel de progresso por um indicador fino que mantém percentual e contagem visíveis, e resumir a linha de filtros ativos em um controle na barra com a lista completa e a remoção individual disponíveis sob demanda. Todos os controles SHALL permanecer acessíveis.

#### Scenario: Progresso permanece visível
- **WHEN** o Board está em Compacta
- **THEN** o percentual e a contagem de conclusão continuam visíveis em um indicador fino

#### Scenario: Filtros resumidos
- **WHEN** há filtros ativos e o Board está em Compacta
- **THEN** a barra mostra um resumo dos filtros que, ao ser acionado, apresenta a lista completa com remoção individual

#### Scenario: Controles preservados
- **WHEN** o Board está em Compacta
- **THEN** alternância Kanban/árvore, filtros, opções, squads, densidade, arquivados e criação continuam acessíveis

### Requirement: Acessibilidade e paridade do modo compacto
O controle de densidade e o resumo de filtros SHALL ter rótulos acessíveis, foco visível e navegação por teclado; o indicador de progresso SHALL ter informação textual. A apresentação SHALL manter contraste e legibilidade nos temas claro e escuro e não SHALL exigir rolagem horizontal.

#### Scenario: Navegação por teclado
- **WHEN** usuário navega pelo Board em Compacta usando teclado
- **THEN** o toggle de densidade e o resumo de filtros recebem foco visível com rótulos que descrevem a ação

#### Scenario: Tema escuro
- **WHEN** o Board está no tema escuro em Compacta
- **THEN** barra, progresso, resumo de filtros e cards usam os tokens do tema e permanecem legíveis
