Board ref: 503e5a70-32a0-4de0-a78d-cb52f4b9c958

## MODIFIED Requirements

### Requirement: Consultas agregadas com limite de resposta

Os endpoints do Dashboard SHALL resolver contagens, agrupamentos e transições por consultas SQL dirigidas ao acervo/tabelas base, eliminando varreduras completas de eventos por item e hidratação integral de folhas no processo HTTP nos caminhos comuns. As listas de detalhe SHALL ter paginação por cursor opaco vinculado ao escopo/filtros, padrão de 50 e máximo de 100 registros, ordenação determinística com desempate por ID e metadados aditivos de continuidade/truncamento. Os totais SHALL permanecer calculados sobre a população completa. Respostas comuns SHALL limitar JSON a 256 KiB sem truncar silenciosamente séries temporais ou totais.

#### Scenario: Snapshot sem varredura completa de eventos
- **WHEN** `/snapshot` calcula detalhes de itens bloqueados
- **THEN** os eventos consultados são apenas os dos itens bloqueados atuais necessários à página, por consulta SQL, e os totais das boxes são calculados por agregação SQL do estado atual

#### Scenario: Burnup sem filtros via rollup
- **WHEN** `/burnup` é consultado sem filtros
- **THEN** a série diária é servida a partir do acervo diário com preenchimento contínuo de dias e retorna os mesmos valores do replay anterior durante o período de cobertura

#### Scenario: Burnup com filtros por replay incremental
- **WHEN** `/burnup` é consultado com filtros de módulo, sprint, versão ou tipo
- **THEN** utiliza projeções históricas agregadas ou checkpoint e deltas limitados ao período sem replay integral desde a baseline no processo HTTP, conserva atributos históricos e devolve os mesmos valores atuais e avisos de cobertura

#### Scenario: Aging sem parse repetido
- **WHEN** `/aging` calcula o início do ciclo ativo de itens em WIP
- **THEN** apenas um evento por item da página (o último iniciado) é determinado por consulta, e a resposta mantém os campos `startedAt`/`ageHours`/`minimumKnown`, totais completos e continuidade da lista

#### Scenario: Hours agregado em SQL
- **WHEN** `/hours` entrega totais e linhas de trabalho manual
- **THEN** os totais são calculados por agregação SQL da população inteira e as linhas respeitam paginação e ordenação determinística

#### Scenario: Cursor de outro recorte
- **WHEN** uma página é solicitada com cursor de outro tenant/projeto/filtro ou cursor inválido
- **THEN** a requisição é rejeitada por validação sem retornar dados de outro escopo

#### Scenario: Detalhes truncados não alteram totais
- **WHEN** snapshot ou sprint possui mais detalhes que o limite da página
- **THEN** os campos de totais mantêm a população completa e a resposta indica truncamento e acesso à continuação sem simular completude
