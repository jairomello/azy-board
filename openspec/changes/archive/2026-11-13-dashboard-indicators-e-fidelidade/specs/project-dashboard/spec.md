# Spec Delta — project-dashboard

## MODIFIED Requirements

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

### Requirement: Distribuição por status
O sistema SHALL distribuir o trabalho em duas leituras distintas: o box WIP SHALL somar apenas os status ativos `IN_PROGRESS`, `IN_HOMOLOGATION` e `BLOCKED`, de modo que o total do box seja a soma das fatias; o recorte por status do box de Tokens SHALL incluir todos os status, inclusive `DONE`, `PLANNED`, `NOT_STARTED` e `CANCELLED`, porque mede consumo.

#### Scenario: Planejado tem bucket próprio
- **WHEN** o projeto tem cards em colunas `PLANNED` e `NOT_STARTED`
- **THEN** o box WIP não os inclui, e o recorte de tokens os mantém em buckets separados

#### Scenario: Total do WIP fecha com as fatias
- **WHEN** o box WIP exibe as fatias por status
- **THEN** a soma das fatias é igual ao total de itens em andamento, em homologação e bloqueados

## REMOVED Requirements

### Requirement: Nove boxes priorizados

## ADDED Requirements

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
