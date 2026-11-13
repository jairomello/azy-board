# project-dashboard Specification

## Purpose
Apresentar o Dashboard do projeto com nove quadros priorizados, filtros de aplicabilidade explícita, populações sem dupla contagem, burnup, aging WIP, tokens de IA e carga da equipe com cobertura declarada, acessível e com estados vazios sem ambiguidade.

## Requirements

### Requirement: Dashboard por projeto
O sistema SHALL oferecer uma página `/projects/:projectId/dashboard` com os dez quadros Progresso e Escopo, Prazo, WIP, Bloqueados, Atrasados, Burnup, Aging WIP, Carga da Equipe, Horas Registradas e Tokens de IA. Sprint e Versões não são renderizados. Além dos dados e listas objetivos existentes, a página SHALL apresentar gráficos adequados, estados visuais completos, tooltips, legendas, tabelas equivalentes e drill-down, mantendo filtros, cobertura parcial, Leaf Rule, RBAC e isolamento por tenant.

#### Scenario: Acesso autorizado
- **WHEN** usuário com papel VIEWER, MEMBER ou ADMIN acessa o Dashboard de projeto ao qual pertence
- **THEN** sistema exibe os dez quadros com dados atuais ou estados explícitos de loading, vazio, erro, parcial ou filtro inaplicável

#### Scenario: Acesso não autorizado
- **WHEN** usuário tenta acessar o Dashboard de projeto sem membership ou de outro tenant
- **THEN** sistema retorna a mesma resposta de recurso não encontrado/autorização usada pelas rotas protegidas e não renderiza dados

#### Scenario: Dados suficientes para gráficos
- **WHEN** um ou mais quadros têm dados agregados
- **THEN** cada quadro aplicável mostra métrica principal, gráfico, legenda/unidade e detalhe textual equivalente, preservando o significado dos dados

#### Scenario: Filtros preservados
- **WHEN** usuário aplica período, módulo, sprint, versão, squad, responsável ou tipo
- **THEN** cada quadro usa somente filtros aplicáveis declarados na resposta e o estado visual identifica filtros inaplicáveis

#### Scenario: Responsividade e acessibilidade
- **WHEN** Dashboard é usado em mobile, teclado ou tema escuro
- **THEN** cards permanecem utilizáveis, os gráficos têm descrição/tabela equivalente, foco visível e informação não dependente exclusivamente de cor

#### Scenario: Escopo excluído
- **WHEN** usuário consulta qualquer estado do Dashboard
- **THEN** interface não exibe finanças, recomendações de IA, capacidade configurável, WIP limit, P85, CFD, throughput, lead/cycle time ou ranking de produtividade

#### Scenario: Quadro de tokens no padrão dos demais
- **WHEN** o projeto possui folhas com tokens registrados
- **THEN** o quadro de Tokens de IA exibe seus recortes e sua série com o mesmo tratamento de estados, filtros, cobertura parcial e acessibilidade dos demais quadros

### Requirement: Dashboard por projeto na navegação
O sistema SHALL disponibilizar `/projects/:projectId/dashboard` e o item "Dashboard" para usuários com leitura do projeto, mantendo o Board como destino padrão ao abrir um projeto.

#### Scenario: Abrir Dashboard
- **WHEN** usuário seleciona "Dashboard" no menu do projeto
- **THEN** sistema abre a página responsiva com os dados do projeto autorizado

#### Scenario: Acesso direto sem projeto autorizado
- **WHEN** usuário tenta abrir Dashboard de projeto fora do seu escopo
- **THEN** API nega a leitura sem revelar dados de outro tenant/projeto

### Requirement: Filtros com aplicabilidade explícita
O sistema SHALL oferecer filtros por período, módulo, sprint, versão, squad, responsável e tipo, persistidos separadamente do Board. Cada resposta SHALL informar quais filtros foram aplicados ou são inaplicáveis ao box.

#### Scenario: Filtro de período em WIP
- **WHEN** usuário seleciona período e consulta WIP atual
- **THEN** box continua representando o estado atual e informa que período não se aplica

#### Scenario: Filtros históricos do burnup
- **WHEN** usuário filtra burnup por período, módulo, sprint, versão ou tipo
- **THEN** série usa os snapshots correspondentes dos eventos cobertos

#### Scenario: Filtro pessoal em Horas Registradas
- **WHEN** usuário filtra pessoa no box Horas Registradas
- **THEN** filtro é rotulado "Autor do log" e o squad corresponde ao squad atual desse autor

#### Scenario: Preservar filtros do Board
- **WHEN** usuário altera filtros no Dashboard e retorna ao Board
- **THEN** filtros salvos do Board permanecem inalterados

### Requirement: População sem dupla contagem
O sistema SHALL calcular cada indicador sobre uma população explícita, determinando a condição de folha antes dos filtros. Progresso, conclusão e SPI SHALL usar folhas `TASK`/`BUG` sem `CANCELLED`; tokens SHALL contar em qualquer status; carga da equipe SHALL considerar somente trabalho em andamento; atraso SHALL seguir a regra vigente com universo próprio. Folhas `EXTERNAL` SHALL ser contadas à parte e não SHALL entrar no progresso. Pais SHALL ser usados apenas para agrupamento.

#### Scenario: Pai oculto pelo filtro
- **WHEN** filtro oculta os filhos de uma TASK pai
- **THEN** TASK pai não passa a ser contabilizada como folha

#### Scenario: Pontos parciais
- **WHEN** parte das folhas não possui pontos
- **THEN** progresso por pontos usa somente pontos conhecidos e exibe cobertura de estimativa

#### Scenario: N/A fora do progresso
- **WHEN** uma folha `TASK`/`BUG` está em `CANCELLED`
- **THEN** ela não entra em progresso, conclusão nem SPI, e é exibida separadamente como N/A fora do escopo

#### Scenario: Dependência externa à parte
- **WHEN** o projeto possui folhas do tipo `EXTERNAL`
- **THEN** elas são contadas em bloco próprio, fora do progresso de trabalho

#### Scenario: Token de card cancelado
- **WHEN** um card cancelado possui tokens registrados
- **THEN** os tokens continuam contando no escopo e nos recortes, porque representam consumo realizado

### Requirement: Boxes de estado atual
O sistema SHALL calcular Progresso e Escopo, Prazo, WIP, Bloqueados, Atrasados e Carga da Equipe a partir do estado atual, permitindo detalhar os itens que compõem cada valor. O box WIP SHALL considerar `IN_PROGRESS`, `IN_HOMOLOGATION` e `BLOCKED` como trabalho aberto em fluxo.

#### Scenario: Item bloqueado
- **WHEN** folha possui status `BLOCKED`
- **THEN** participa de WIP e Bloqueados, exibindo motivo e responsável quando disponíveis

#### Scenario: Item em homologação
- **WHEN** folha possui status `IN_HOMOLOGATION`
- **THEN** participa de WIP na chave própria `IN_HOMOLOGATION` e não participa de Progresso como concluída

#### Scenario: Item atrasado
- **WHEN** folha não concluída/cancelada possui `dueDate` anterior à data civil atual
- **THEN** participa de Atrasados e pode ser aberta no detalhamento

#### Scenario: Versão sem itens
- **WHEN** versão não possui folhas associadas
- **THEN** box exibe escopo zero sem calcular percentual inválido

#### Scenario: Carga da equipe
- **WHEN** itens ativos possuem responsáveis membros de squads
- **THEN** box agrupa WIP e bloqueios por squad/membro sem score ou ranking de produtividade

#### Scenario: Universo do donut de atrasados
- **WHEN** o box de Atrasados compara atrasados com o restante
- **THEN** o universo é o escopo de trabalho completo, incluindo N/A, e o restante é o universo menos os atrasados

### Requirement: Burnup com cobertura explícita
O sistema SHALL exibir o estado ao fim de cada dia UTC com linhas de escopo total e concluído por contagem ou pontos desde `coverageStartedAt`. Escopo SHALL usar folhas `TASK`/`BUG` não arquivadas e concluído SHALL significar `DONE`. Mudanças de escopo SHALL aparecer na linha total, sem calcular burndown ou box isolado de churn.

#### Scenario: Pontos alterados
- **WHEN** pontos mudam durante o período coberto
- **THEN** linha de escopo total muda na data do evento e preserva valores anteriores

#### Scenario: Período anterior à cobertura
- **WHEN** intervalo começa antes de `coverageStartedAt`
- **THEN** gráfico inicia no baseline disponível e indica cobertura parcial

### Requirement: Aging WIP observado
O sistema SHALL calcular aging do episódio ativo atual. Entrada em `IN_PROGRESS`, `IN_HOMOLOGATION` ou `BLOCKED` inicia o episódio, transição entre eles não zera, saída para `NOT_STARTED`, `PLANNED`, `DONE`, `CANCELLED` ou `ARCHIVED` encerra e uma nova entrada, inclusive por restauração ativa, inicia outro. Para item já ativo no baseline sem início conhecido, SHALL exibir idade mínima desde `coverageStartedAt`.

#### Scenario: Card planejado não acumula aging
- **WHEN** um card passa de `IN_PROGRESS` para uma coluna `PLANNED`
- **THEN** o episódio ativo encerra e o card não acumula aging enquanto estiver planejado

#### Scenario: Item iniciado após cobertura
- **WHEN** item entra em trabalho após `coverageStartedAt`
- **THEN** aging usa o instante da primeira transição observada

#### Scenario: Item ativo legado
- **WHEN** baseline encontra item já ativo sem evento de início
- **THEN** box identifica a idade como mínima conhecida e não afirma a data real de início

### Requirement: Horas registradas existentes
O sistema SHALL somar somente logs `manual` com `durationMin > 0`, usando `createdAt` como data de registro e agrupando por projeto, item, autor/squad atual do autor e dimensões atuais do item quando aplicável.

#### Scenario: Log automático
- **WHEN** log automático existe no período
- **THEN** sua duração não participa de Horas Registradas

#### Scenario: Log manual sem duração
- **WHEN** log manual não possui `durationMin`
- **THEN** ele não é contado e não é tratado como zero horas trabalhadas

#### Scenario: Horas por responsável
- **WHEN** usuário filtra responsável
- **THEN** box usa o autor do log para horas registradas e declara essa semântica, sem inferir horas pelo responsável atual do item

### Requirement: Subconjuntos da carga da equipe
O sistema SHALL apresentar `wipTotal` e `blockedSubset` por squad/membro, onde bloqueados são subconjunto não aditivo do WIP e `blockedSubset <= wipTotal`. As barras SHALL representar somente trabalho em andamento: bloqueados e itens com responsável externo (`assigneeLabel` sem usuário) não sobrecarregam a equipe e SHALL ficar fora da carga, com a quantidade excluída informada no box.

#### Scenario: Membro com item bloqueado
- **WHEN** membro possui uma única folha `BLOCKED`
- **THEN** carga mostra WIP 1 e bloqueados 1, sem somá-los como dois itens

#### Scenario: Item com responsável externo
- **WHEN** uma folha ativa tem apenas `assigneeLabel` preenchido
- **THEN** ela não aparece como carga de nenhum membro e é contabilizada como responsável externo fora da carga

#### Scenario: Sem estimativa no modo pontos
- **WHEN** o usuário alterna a carga para pontos e nenhum item tem estimativa
- **THEN** o box mostra estado vazio de pontos e mantém o seletor acessível para voltar à visão por itens

### Requirement: Acessibilidade e estados
O sistema SHALL oferecer labels/valores textuais, alternativa tabular para gráficos, foco por teclado, informação não dependente apenas de cor e estados de carregamento, vazio, erro e cobertura parcial.

#### Scenario: Projeto vazio
- **WHEN** projeto não possui folhas elegíveis
- **THEN** Dashboard exibe estado vazio sem percentuais enganosos

#### Scenario: Leitor de tela
- **WHEN** usuário consulta burnup com tecnologia assistiva
- **THEN** título, período, cobertura e série tabular equivalente estão disponíveis

### Requirement: Indicador de avanço no dashboard

O dashboard SHALL apresentar o avanço do projeto pela regra do peso de coluna, ao lado da conclusão, dentro do quadro de progresso e escopo, com rótulo que distinga avanço no fluxo de entrega concluída. A lista de quadros permanece a atual; o avanço não SHALL substituir a métrica de conclusão nem alterar escopo, burnup ou cobertura de estimativa.

#### Scenario: Avanço com cards em progresso

- **WHEN** o dashboard é aberto em um projeto com folhas em `IN_PROGRESS` e nenhuma concluída
- **THEN** o avanço mostra o percentual derivado das colunas, distinto do 0% de conclusão

#### Scenario: Avanço respeita filtros aplicáveis

- **WHEN** o usuário aplica filtros de módulo, sprint, versão, squad, responsável ou tipo
- **THEN** o avanço é recalculado sobre a mesma população filtrada usada pelos demais quadros

#### Scenario: Rótulos não confundem avanço com entrega

- **WHEN** o quadro de progresso e escopo exibe os dois indicadores
- **THEN** a conclusão é rotulada como concluídos e o avanço como avanço no fluxo

### Requirement: Ausência de estimativas tratada explicitamente

Quando a cobertura de estimativa de um projeto for zero, o dashboard SHALL NOT apresentar valores de pontos como resultado: as visões de pontos SHALL ser omitidas e substituídas por uma orientação acionável de que o projeto não tem estimativas. As visões de pontos SHALL voltar a aparecer quando existir ao menos um item estimado na população.

#### Scenario: Projeto sem estimativas

- **WHEN** nenhum item da população tem pontos
- **THEN** as visões de pontos não exibem `0/0` nem percentuais de cobertura como se fossem resultado, e o quadro orienta a definir estimativas

#### Scenario: Projeto com estimativas parciais

- **WHEN** parte da população tem pontos
- **THEN** as visões de pontos aparecem com a cobertura de estimativa informada

### Requirement: Cobertura parcial explicada na origem da série

Quadros históricos com cobertura parcial SHALL explicar que a série começa na data de início da cobertura e que itens cujo início do episódio coincide com essa data estão saturados no limite da cobertura observada. A explicação SHALL NOT ser apresentada quando a cobertura for completa.

#### Scenario: Burnup com cobertura parcial

- **WHEN** o quadro de burnup é exibido em um projeto cuja cobertura começou depois do início do projeto
- **THEN** o quadro informa a data de início da cobertura e que a série é limitada a ela

#### Scenario: Aging saturado no início da cobertura

- **WHEN** itens do aging têm o início do episódio igual à data de início da cobertura
- **THEN** o quadro sinaliza que esses itens têm idade mínima conhecida, e não idade real

#### Scenario: Cobertura completa não explica nada

- **WHEN** a cobertura do quadro é completa
- **THEN** nenhuma mensagem de cobertura parcial é exibida

### Requirement: Rótulos legíveis nos rankings do dashboard

Os rankings do dashboard SHALL rotular cada item com o código sequencial ou o título do card, e SHALL NOT usar o identificador técnico. O título completo SHALL permanecer acessível por tooltip ou detalhe do item.

#### Scenario: Ranking do aging

- **WHEN** o quadro de aging lista os itens mais antigos
- **THEN** cada barra é rotulada com o código ou o título do card, e não com o identificador

#### Scenario: Ranking de bloqueados

- **WHEN** o quadro de bloqueados lista itens
- **THEN** cada barra é rotulada com o código ou o título do card

#### Scenario: Título completo acessível

- **WHEN** o rótulo é abreviado para caber no eixo
- **THEN** o título completo permanece disponível no tooltip ou no detalhe do item

### Requirement: Estados vazios e legendas sem ambiguidade

Os quadros do dashboard SHALL usar estado vazio compacto quando não houver dados, sem reservar a altura de um gráfico, e SHALL apresentar legendas sem repetição e sem repetir a unidade já indicada pelo rótulo.

#### Scenario: Quadro sem dados

- **WHEN** um quadro não tem dados na população filtrada
- **THEN** ele exibe uma mensagem vazia compacta, sem área de gráfico reservada

#### Scenario: Legenda de gráfico com dois recortes

- **WHEN** um quadro apresenta dois gráficos do mesmo conjunto
- **THEN** a legenda de cada categoria aparece uma única vez

#### Scenario: Unidade não repetida

- **WHEN** a métrica principal de um quadro tem rótulo e unidade equivalentes
- **THEN** a unidade não é repetida no mesmo valor

### Requirement: Burnup sem evolução no período

Quando o período exibido não tiver nenhuma conclusão e o escopo não variar, o quadro de burnup SHALL apresentar uma mensagem explícita de ausência de evolução em vez do gráfico reto, mantendo as notas de cobertura aplicáveis. Havendo conclusão ou variação de escopo em qualquer ponto do período, o gráfico SHALL ser exibido normalmente.

#### Scenario: Período sem conclusão e com escopo constante

- **WHEN** o burnup é exibido em um projeto cuja série do período tem concluídos zero e escopo constante
- **THEN** o quadro informa que não houve conclusão no período e que o escopo se manteve, sem desenhar o gráfico reto

#### Scenario: Período com conclusão

- **WHEN** ao menos um dia do período registra itens concluídos
- **THEN** o gráfico do burnup é exibido normalmente

#### Scenario: Escopo variou sem conclusão

- **WHEN** o escopo muda dentro do período e nenhuma conclusão é registrada
- **THEN** o gráfico continua sendo exibido, porque a variação de escopo é informação do quadro

#### Scenario: Cobertura parcial permanece explicada

- **WHEN** o quadro apresenta a mensagem de ausência de evolução em um projeto com cobertura parcial
- **THEN** as notas de cobertura e a data de início da série continuam visíveis

### Requirement: Recorte de pontos do burnup segue a cobertura de estimativa

O recorte de pontos do burnup SHALL NOT ser oferecido quando a cobertura de estimativa da população for zero, seguindo a regra do dashboard para visões de pontos; o quadro SHALL orientar a estimar no lugar de apresentar uma série vazia.

#### Scenario: Projeto sem estimativas

- **WHEN** nenhum item da população tem pontos e o usuário abre o quadro de burnup
- **THEN** o recorte de pontos não é oferecido e o quadro orienta a definir estimativas

#### Scenario: Projeto com estimativas

- **WHEN** existe ao menos um item estimado na população
- **THEN** o recorte de pontos permanece disponível e alterna acessivelmente entre itens e pontos

### Requirement: Distribuição por status
O sistema SHALL distribuir o trabalho em duas leituras distintas: o box WIP SHALL somar apenas os status ativos `IN_PROGRESS`, `IN_HOMOLOGATION` e `BLOCKED`, de modo que o total do box seja a soma das fatias; o recorte por status do box de Tokens SHALL incluir todos os status, inclusive `DONE`, `PLANNED`, `NOT_STARTED` e `CANCELLED`, porque mede consumo.

#### Scenario: Planejado tem bucket próprio
- **WHEN** o projeto tem cards em colunas `PLANNED` e `NOT_STARTED`
- **THEN** o box WIP não os inclui, e o recorte de tokens os mantém em buckets separados

#### Scenario: Total do WIP fecha com as fatias
- **WHEN** o box WIP exibe as fatias por status
- **THEN** a soma das fatias é igual ao total de itens em andamento, em homologação e bloqueados

### Requirement: Dez boxes priorizados
O sistema SHALL exibir exatamente os grupos Progresso e Escopo, Prazo, WIP, Bloqueados, Atrasados, Burnup, Aging WIP, Tokens de IA, Carga da Equipe e Horas Registradas. Sprint e Versões SHALL NOT ser renderizados como quadros; eles permanecem disponíveis apenas como filtros quando aplicáveis. O sistema SHALL NOT exibir finanças, ações prioritárias, avaliação qualitativa ou recomendação por IA.

#### Scenario: Renderizar visão geral
- **WHEN** Dashboard possui dados disponíveis
- **THEN** os dez boxes são apresentados conforme aplicabilidade e cobertura

#### Scenario: Dados insuficientes
- **WHEN** box histórico não possui cobertura suficiente
- **THEN** sistema mostra estado parcial/indisponível e não fabrica o valor

### Requirement: Indicadores de prazo
O sistema SHALL expor `GET /projects/:projectId/dashboard/indicators`, somente leitura, com SPI, percentual esperado, dias para o término, conclusão, avanço no fluxo, total do escopo ativo, N/A, externos, atrasados, bloqueados, WIP e responsáveis. O SPI SHALL ser a conclusão do escopo ativo dividida pelo percentual esperado para a data corrente. O endpoint SHALL aceitar os mesmos filtros de população do snapshot e SHALL NOT alterar dados.

#### Scenario: SPI a partir da conclusão
- **WHEN** o escopo ativo tem conclusão de 54% e o esperado para hoje é 98%
- **THEN** o SPI é 0,55 e o farol indica crítico

#### Scenario: Farol do SPI
- **WHEN** o SPI é calculado
- **THEN** verde a partir de 0,95, amarelo a partir de 0,85, vermelho abaixo disso e sem dados quando não há datas de projeto

#### Scenario: Sem datas de projeto
- **WHEN** o projeto não tem data de início ou término planejado
- **THEN** esperado, SPI, dias decorridos e dias para o término são nulos e o farol indica sem dados

#### Scenario: Coerência com o snapshot
- **WHEN** o mesmo filtro é aplicado ao snapshot e aos indicadores
- **THEN** conclusão, avanço, WIP, bloqueados e atrasados coincidem entre os dois endpoints

### Requirement: Higiene da base
O sistema SHALL informar, para as folhas abertas, quantas estão sem responsável, sem prazo, concluídas sem data realizada, em andamento sem início realizado e bloqueadas sem motivo. `assigneeLabel` SHALL contar como responsável.

#### Scenario: Folha sem responsável
- **WHEN** uma folha aberta não tem usuário, API key nem `assigneeLabel`
- **THEN** ela é contada em “sem responsável”

#### Scenario: Responsável externo não é lacuna
- **WHEN** uma folha aberta tem apenas `assigneeLabel`
- **THEN** ela não é contada em “sem responsável”

### Requirement: Ajuda de leitura por indicador
O sistema SHALL oferecer, em cada quadro e em cada KPI do box Prazo, um controle de informação que descreve como ler o indicador. O controle SHALL ser acionável por teclado, expor rótulo acessível e SHALL NOT depender de cor ou de hover para revelar o texto.

#### Scenario: Abrir a ajuda de um KPI
- **WHEN** usuário aciona o controle de informação do SPI
- **THEN** o sistema exibe a regra de leitura do indicador em texto

#### Scenario: Navegação por teclado
- **WHEN** usuário navega por teclado até o controle de informação
- **THEN** o controle recebe foco visível, informa o rótulo “Como ler …” e pode ser aberto e fechado sem mouse
