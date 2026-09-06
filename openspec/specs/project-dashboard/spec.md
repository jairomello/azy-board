# project-dashboard Specification

## Purpose
TBD - created by archiving change enhance-project-dashboard-visuals. Update Purpose after archive.
## Requirements
### Requirement: Dashboard por projeto
O sistema SHALL oferecer uma página `/projects/:projectId/dashboard` com os oito quadros Progresso e Escopo, WIP, Bloqueados, Atrasados, Burnup, Aging WIP, Carga da Equipe e Horas Registradas. Sprint e Versões não são renderizados. Além dos dados e listas objetivos existentes, a página SHALL apresentar gráficos adequados, estados visuais completos, tooltips, legendas, tabelas equivalentes e drill-down, mantendo filtros, cobertura parcial, Leaf Rule, RBAC e isolamento por tenant.

#### Scenario: Acesso autorizado
- **WHEN** usuário com papel VIEWER, MEMBER ou ADMIN acessa o Dashboard de projeto ao qual pertence
- **THEN** sistema exibe os oito quadros com dados atuais ou estados explícitos de loading, vazio, erro, parcial ou filtro inaplicável

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

### Requirement: Dashboard por projeto na navegação
O sistema SHALL disponibilizar `/projects/:projectId/dashboard` e o item "Dashboard" para usuários com leitura do projeto, mantendo o Board como destino padrão ao abrir um projeto.

#### Scenario: Abrir Dashboard
- **WHEN** usuário seleciona "Dashboard" no menu do projeto
- **THEN** sistema abre a página responsiva com os dados do projeto autorizado

#### Scenario: Acesso direto sem projeto autorizado
- **WHEN** usuário tenta abrir Dashboard de projeto fora do seu escopo
- **THEN** API nega a leitura sem revelar dados de outro tenant/projeto

### Requirement: Dez boxes priorizados
O sistema SHALL exibir exatamente os grupos Progresso e Escopo, WIP, Bloqueados, Atrasados, Burnup, Aging WIP, Sprint, Versões, Carga da Equipe e Horas Registradas. O sistema SHALL NOT exibir finanças, ações prioritárias, avaliação qualitativa ou recomendação por IA.

#### Scenario: Renderizar visão geral
- **WHEN** Dashboard possui dados disponíveis
- **THEN** os dez boxes são apresentados conforme aplicabilidade e cobertura

#### Scenario: Dados insuficientes
- **WHEN** box histórico não possui cobertura suficiente
- **THEN** sistema mostra estado parcial/indisponível e não fabrica o valor

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
O sistema SHALL calcular métricas de execução sobre folhas `TASK`/`BUG` não arquivadas, determinando a condição de folha antes dos filtros. Pais SHALL ser usados apenas para agrupamento.

#### Scenario: Pai oculto pelo filtro
- **WHEN** filtro oculta os filhos de uma TASK pai
- **THEN** TASK pai não passa a ser contabilizada como folha

#### Scenario: Pontos parciais
- **WHEN** parte das folhas não possui pontos
- **THEN** progresso por pontos usa somente pontos conhecidos e exibe cobertura de estimativa

### Requirement: Boxes de estado atual
O sistema SHALL calcular Progresso e Escopo, WIP, Bloqueados, Atrasados, Versões e Carga da Equipe a partir do estado atual, permitindo detalhar os itens que compõem cada valor.

#### Scenario: Item bloqueado
- **WHEN** folha possui status `BLOCKED`
- **THEN** participa de WIP e Bloqueados, exibindo motivo e responsável quando disponíveis

#### Scenario: Item atrasado
- **WHEN** folha não concluída/cancelada possui `dueDate` anterior à data civil atual
- **THEN** participa de Atrasados e pode ser aberta no detalhamento

#### Scenario: Versão sem itens
- **WHEN** versão não possui folhas associadas
- **THEN** box exibe escopo zero sem calcular percentual inválido

#### Scenario: Carga da equipe
- **WHEN** itens ativos possuem responsáveis membros de squads
- **THEN** box agrupa WIP e bloqueios por squad/membro sem score ou ranking de produtividade

### Requirement: Burnup com cobertura explícita
O sistema SHALL exibir o estado ao fim de cada dia UTC com linhas de escopo total e concluído por contagem ou pontos desde `coverageStartedAt`. Escopo SHALL usar folhas `TASK`/`BUG` não arquivadas e concluído SHALL significar `DONE`. Mudanças de escopo SHALL aparecer na linha total, sem calcular burndown ou box isolado de churn.

#### Scenario: Pontos alterados
- **WHEN** pontos mudam durante o período coberto
- **THEN** linha de escopo total muda na data do evento e preserva valores anteriores

#### Scenario: Período anterior à cobertura
- **WHEN** intervalo começa antes de `coverageStartedAt`
- **THEN** gráfico inicia no baseline disponível e indica cobertura parcial

### Requirement: Aging WIP observado
O sistema SHALL calcular aging do episódio ativo atual. Entrada em `IN_PROGRESS`/`BLOCKED` inicia o episódio, transição entre ambos não zera, saída para `NOT_STARTED`, `DONE`, `CANCELLED` ou `ARCHIVED` encerra e uma nova entrada, inclusive por restauração ativa, inicia outro. Para item já ativo no baseline sem início conhecido, SHALL exibir idade mínima desde `coverageStartedAt`.

#### Scenario: Item iniciado após cobertura
- **WHEN** item entra em trabalho após `coverageStartedAt`
- **THEN** aging usa o instante da primeira transição observada

#### Scenario: Item ativo legado
- **WHEN** baseline encontra item já ativo sem evento de início
- **THEN** box identifica a idade como mínima conhecida e não afirma a data real de início

### Requirement: Sprint por ciclo
O sistema SHALL exibir compromisso como folhas do início do ciclo selecionado, escopo atual como associação no corte `min(agora, cycle.endedAt)`, concluído como `DONE` nesse corte e compromisso não concluído como itens iniciais sem `DONE/CANCELLED` no fim do ciclo. "Carry-over" SHALL ser exibido somente quando associação posterior for observada. Ciclo `MIGRATION` SHALL ser identificado como parcial.

#### Scenario: Sprint aberta após implantação
- **WHEN** sprint é aberta com itens associados
- **THEN** box usa o ciclo/baseline capturado na abertura como compromisso

#### Scenario: Sprint legada
- **WHEN** sprint fechada antes da cobertura é consultada
- **THEN** box informa ausência de ciclo e mostra somente dados atuais claramente rotulados, se úteis

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
O sistema SHALL apresentar `wipTotal` e `blockedSubset` por squad/membro, onde bloqueados são subconjunto não aditivo do WIP e `blockedSubset <= wipTotal`.

#### Scenario: Membro com item bloqueado
- **WHEN** membro possui uma única folha `BLOCKED`
- **THEN** carga mostra WIP 1 e bloqueados 1, sem somá-los como dois itens

### Requirement: Acessibilidade e estados
O sistema SHALL oferecer labels/valores textuais, alternativa tabular para gráficos, foco por teclado, informação não dependente apenas de cor e estados de carregamento, vazio, erro e cobertura parcial.

#### Scenario: Projeto vazio
- **WHEN** projeto não possui folhas elegíveis
- **THEN** Dashboard exibe estado vazio sem percentuais enganosos

#### Scenario: Leitor de tela
- **WHEN** usuário consulta burnup com tecnologia assistiva
- **THEN** título, período, cobertura e série tabular equivalente estão disponíveis
