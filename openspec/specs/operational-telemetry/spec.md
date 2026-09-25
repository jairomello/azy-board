## ADDED Requirements

### Requirement: Telemetria opcional por configuração

A instrumentação de tracing e métricas SHALL ser ativada apenas quando um endpoint de exportação OTLP estiver configurado. Sem essa configuração, a aplicação SHALL operar com instrumentação no-op, sem exportação de dados e sem mudança perceptível de comportamento ou consumo — em particular no perfil SIMPLE, que SHALL continuar sem serviços externos obrigatórios.

#### Scenario: Sem endpoint OTLP configurado
- **WHEN** a aplicação sobe sem `OTEL_EXPORTER_OTLP_ENDPOINT`
- **THEN** nenhuma telemetria é exportada e os fluxos da aplicação funcionam normalmente

#### Scenario: Com endpoint OTLP configurado
- **WHEN** a aplicação sobe com `OTEL_EXPORTER_OTLP_ENDPOINT` válido
- **THEN** traces e métricas são exportados para o coletor informado

### Requirement: Métricas HTTP de latência e erros

A aplicação SHALL registrar métricas de duração e contagem de requisições HTTP por método, rota e status, além de contagem de erros, permitindo identificar rotas lentas e taxas de falha.

#### Scenario: Duração por rota
- **WHEN** uma requisição é atendida
- **THEN** a duração e o status são registrados na métrica HTTP correspondente à rota

#### Scenario: Erros são contados
- **WHEN** uma requisição termina em status 5xx ou em exceção não tratada
- **THEN** o contador de erros da aplicação é incrementado

### Requirement: Métricas de bloqueios e transações de banco

A aplicação SHALL registrar métricas de conflito de acesso ao banco (novas tentativas por lock/busy e duração de transações críticas), medidas nos pontos reais de conflito do código de persistência.

#### Scenario: Nova tentativa por lock
- **WHEN** uma transação precisa ser repetida por conflito de lock/busy do banco
- **THEN** o contador de novas tentativas por lock é incrementado

#### Scenario: Transação crítica medida
- **WHEN** uma unidade de trabalho transacional conclui
- **THEN** sua duração é registrada na métrica de transações

### Requirement: Métricas da fila de limpeza de storage

A fila de limpeza de storage SHALL expor métricas de itens pendentes, idade do item mais antigo, itens processados e itens com falha, permitindo alertar sobre acúmulo e erro de processamento.

#### Scenario: Itens pendentes
- **WHEN** existem itens aguardando processamento na fila
- **THEN** o gauge de pendentes e a idade do mais antigo refletem o estado da fila

#### Scenario: Processamento e falha
- **WHEN** um item da fila é processado ou falha definitivamente
- **THEN** os contadores de processados e de falhas são incrementados

### Requirement: Métricas de runs do agente

Runs do agente SHALL registrar métricas de execução (steps, chamadas de ferramenta, tokens de entrada/saída, custo acumulado e rejeições por quota), permitindo acompanhar consumo e limites.

#### Scenario: Run concluído
- **WHEN** um run do agente conclui
- **THEN** steps, tokens e custo do run são registrados nas métricas do agente

#### Scenario: Quota rejeitada
- **WHEN** uma execução do agente é recusada por quota/orçamento
- **THEN** o contador de rejeições por quota é incrementado

### Requirement: Tracing correlacionado por requisição

Cada requisição HTTP SHALL gerar um span de tracing com o request ID associado como atributo, permitindo correlacionar traces, logs e respostas da mesma requisição.

#### Scenario: Span por requisição
- **WHEN** uma requisição é atendida com telemetria ativa
- **THEN** existe um span de servidor HTTP para ela contendo o request ID como atributo

#### Scenario: Correlação com logs
- **WHEN** um trace é inspecionado em um erro
- **THEN** o request ID do span permite localizar o log estruturado da mesma requisição
