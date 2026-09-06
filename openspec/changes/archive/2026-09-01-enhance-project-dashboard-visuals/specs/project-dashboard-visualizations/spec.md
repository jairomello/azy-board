## ADDED Requirements

### Requirement: Cards gráficos dos dez quadros
O Dashboard SHALL apresentar os oito quadros do recorte atual com uma visualização gráfica apropriada, uma métrica principal e um detalhe textual correspondente. Sprint e Versões não devem ser renderizados como cards.

#### Scenario: Dashboard com dados atuais
- **WHEN** usuário VIEWER acessa um projeto com itens, sprints, versões, equipe ou logs
- **THEN** cada quadro aplicável exibe métrica, gráfico coerente com seu domínio, legenda/unidade e detalhe objetivo

#### Scenario: Dashboard sem dados
- **WHEN** um quadro não possui dados suficientes para gerar uma série
- **THEN** o quadro exibe estado vazio explicativo, preserva seu título e não fabrica pontos ou categorias

### Requirement: Visualizações específicas por quadro
Os gráficos SHALL representar progresso por donut/barras, WIP por status, bloqueios e atrasos por distribuição, Burnup por área temporal, Aging por faixas de idade, Sprint por comparação de compromisso, Versões por progresso, Carga por WIP/bloqueios e Horas por período.

#### Scenario: Burnup com histórico parcial
- **WHEN** existem eventos históricos somente desde o início da cobertura
- **THEN** o gráfico apresenta escopo e concluídos por dia, marca a cobertura parcial e mantém tabela equivalente

#### Scenario: Carga da equipe
- **WHEN** existem itens WIP atribuídos e não atribuídos
- **THEN** o gráfico mostra somente a quantidade de itens não bloqueados por pessoa, incluindo sem responsável, e alterna acessivelmente entre itens e pontos com cobertura

#### Scenario: Horas agrupadas por autor
- **WHEN** existem logs manuais positivos de um ou mais autores
- **THEN** o card mantém o total geral e mostra um donut cuja fatia representa o total de horas somado por autor

### Requirement: Estados visuais e cobertura
Cada card SHALL suportar loading, vazio, erro, cobertura parcial e filtro inaplicável com uma apresentação visual consistente e semanticamente rotulada.

#### Scenario: Carregamento
- **WHEN** uma consulta do Dashboard está pendente
- **THEN** o card exibe skeleton visual do conteúdo esperado e não apresenta valores fictícios

#### Scenario: Filtro inaplicável
- **WHEN** um filtro não se aplica a determinado quadro
- **THEN** o quadro informa a inaplicabilidade sem alterar silenciosamente seus dados

### Requirement: Interação gráfica e drill-down
Os gráficos SHALL oferecer tooltip acessível, legenda e ação de detalhe; ações de detalhe SHALL abrir o item ou Board com contexto objetivo sem expor dados de outro tenant.

#### Scenario: Abrir item pelo detalhe
- **WHEN** usuário ativa o link de um item listado ou ponto detalhado
- **THEN** sistema abre o item no Board do mesmo projeto preservando a autorização existente

#### Scenario: Tooltip por teclado
- **WHEN** usuário navega por teclado até uma série ou controle do gráfico
- **THEN** recebe rótulo textual com categoria, valor e unidade sem depender de hover ou cor

### Requirement: Biblioteca e consistência visual
O frontend SHALL usar uma biblioteca de gráficos gratuita com licença permitida, tokens de cor semânticos, cards de altura consistente e layout responsivo.

#### Scenario: Tema e contraste
- **WHEN** usuário alterna tema claro/escuro ou acessa com contraste reduzido
- **THEN** gráficos, textos e estados permanecem legíveis e cada série continua distinguível por rótulo, padrão ou tabela

#### Scenario: Mobile
- **WHEN** viewport possui largura de dispositivo móvel
- **THEN** cards ocupam uma coluna, gráficos permanecem legíveis e detalhes não exigem rolagem horizontal da página
