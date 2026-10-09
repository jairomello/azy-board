# Spec Delta

## MODIFIED Requirements

### Requirement: Densidade do Board controla cabeçalho e cards
O Board SHALL manter uma preferência única de densidade com os estados Confortável e Compacta. Confortável SHALL usar a composição visual alinhada ao protótipo; Compacta SHALL reduzir espaçamento e altura do cabeçalho e dos cards sem mudar a identidade visual, ocultar controles ou alterar filtros e visualização. O toggle SHALL ter `aria-pressed` e rótulo traduzido em PT-BR, EN e ES.

#### Scenario: Padrão preservado
- **WHEN** usuário abre o Board sem preferência de densidade definida
- **THEN** cabeçalho, canvas, colunas e cards usam o layout confortável alinhado ao protótipo

#### Scenario: Acionar densidade compacta
- **WHEN** usuário alterna para Compacta
- **THEN** o cabeçalho e os cards ficam mais densos em conjunto, conservando filtros, visualização e paleta ativa

#### Scenario: Retornar a Confortável
- **WHEN** usuário alterna para Confortável
- **THEN** espaçamentos e regiões completas retornam sem perder filtros ou estado de visualização

### Requirement: Compactação efetiva dos cards
No estado Compacta, o sistema SHALL reduzir os espaçamentos internos, limitar o título a uma linha e ocultar o breadcrumb. O título completo SHALL permanecer acessível por tooltip; topo, etiquetas/tipo, progresso de checklist e rodapé SHALL permanecer disponíveis e legíveis nos temas claro e escuro.

#### Scenario: Cards visivelmente mais densos
- **WHEN** o Board está em Compacta
- **THEN** cards têm menor altura que no modo confortável e conservam topo, tags/tipo, checklist quando aplicável e rodapé sem colisões

#### Scenario: Título completo acessível
- **WHEN** o título é truncado no modo Compacta
- **THEN** o texto integral permanece disponível por tooltip e a edição inline continua funcionando

#### Scenario: Confortável restaura o layout completo
- **WHEN** usuário retorna a Confortável
- **THEN** breadcrumb e título em até duas linhas retornam com o visual alinhado ao protótipo

#### Scenario: Alternância mantém contraste temático
- **WHEN** o usuário alterna densidade em tema claro ou escuro
- **THEN** tipografia, contornos, divisores e estados continuam legíveis sem alterar o tema efetivo

#### Scenario: Efeito perceptível em relação ao estado anterior
- **WHEN** usuário alterna entre Compacta e Confortável com cards exibidos
- **THEN** a mudança de densidade é perceptível na tela, sem perda de informação além do breadcrumb e do truncamento do título

### Requirement: Layout do cabeçalho no modo compacto
No estado Compacta, o Board SHALL reduzir a altura e as margens da barra de comandos, substituir o painel de progresso por um indicador fino com percentual e contagem, e resumir filtros ativos em um controle que mantém a lista completa e remoção individual sob demanda. A densidade SHALL conservar a composição e os tokens temáticos do Board.

#### Scenario: Progresso permanece visível
- **WHEN** o Board está em Compacta
- **THEN** percentual e contagem de conclusão continuam visíveis em indicador fino

#### Scenario: Filtros resumidos
- **WHEN** existem filtros ativos no modo compacto
- **THEN** a barra mostra a quantidade e permite abrir a lista completa com remoção individual

#### Scenario: Controles preservados
- **WHEN** o Board está em Compacta
- **THEN** alternância Kanban/árvore, filtros, opções, squads, densidade, arquivados e criação continuam acessíveis

### Requirement: Acessibilidade e paridade do modo compacto
O controle de densidade, resumo de filtros, indicador de progresso, barra, canvas e cards SHALL manter rótulos acessíveis, foco visível, navegação por teclado e contraste nos temas claro e escuro. O modo compacto SHALL NOT exigir rolagem horizontal adicional além da rolagem natural do canvas Kanban.

#### Scenario: Navegação por teclado
- **WHEN** usuário navega pelo Board em Compacta usando teclado
- **THEN** toggle, resumo de filtros e ações recebem foco visível e rótulos claros

#### Scenario: Tema escuro
- **WHEN** o Board está em tema escuro e Compacta
- **THEN** barra, progresso, filtros e cards usam tokens escuros legíveis e preservam seus estados
