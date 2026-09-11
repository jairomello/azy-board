# agent-eval-suite — Delta

## ADDED Requirements

### Requirement: Suíte de evals do Azy Agent

O projeto SHALL manter uma suíte de evals executável que rode o Azy Agent real (harness + provider + tools + banco seedado) contra um dataset versionado de casos, medindo a qualidade, segurança e completude das respostas. A suíte SHALL calcular ao menos as dimensões: task completion, tool correctness, faithfulness, escopo/relevância e segurança.

#### Scenario: Caso de criação hierárquica é avaliado
- **WHEN** um caso pede a criação de EPIC, STORY e TASK em lote e a run conclui
- **THEN** a suíte registra os tool calls executados, os argumentos usados, o estado final do banco e uma pontuação por dimensão para o caso

### Requirement: Tool correctness determinística
Quando o caso declara tool e argumentos-chave esperados para a mutação, a suíte SHALL marcar tool correctness por comparação determinística de código, sem usar judge para critério que possui ground truth.

#### Scenario: Tool correctness determinística
- **WHEN** o caso declara tool e argumentos-chave esperados para a mutação
- **THEN** a suíte marca tool correctness por comparação determinística de código, sem usar judge para o critério que possui ground truth

#### Scenario: Critérios qualitativos via judge
- **WHEN** um caso declara critérios qualitativos (faithfulness, escopo, alinhamento)
- **THEN** a suíte os avalia com LLM-as-judge usando saída estruturada em escala 0–1, e registrar falha do judge como caso indeterminado no relatório, nunca como sucesso

### Requirement: Gate de release por thresholds

O projeto SHALL fornecer um gate de release (`evals:gate`) que exija pontuação mínima por dimensão, falhando com código de erro quando qualquer threshold não for atendido. O gate SHALL ser executado por release/tag e SHALL não fazer parte do fluxo determinístico `bun run check`.

#### Scenario: Gate satisfeito
- **WHEN** todas as dimensões atingem seus thresholds mínimos
- **THEN** o gate finaliza com sucesso e publica o relatório da suíte executada

#### Scenario: Gate violado
- **WHEN** qualquer dimensão fica abaixo do threshold
- **THEN** o gate finaliza com erro, listando dimensões violadas e casos reprovados

#### Scenario: Regressão de qualidade entre releases
- **WHEN** o novo relatório é comparado ao baseline anterior e uma dimensão cai além da margem configurada
- **THEN** o gate emite aviso explícito de regressão de qualidade, mesmo estando dentro do threshold absoluto

### Requirement: Dataset versionado revisável

Os casos SHALL ser definidos em arquivos tipados versionados no repositório, cada um com mensagem do usuário, setup declarativo do banco, expectativas determinísticas e critérios de judge. Todo caso novo SHALL passar pelo fluxo de PR como código.

#### Scenario: Caso é adicionado ao dataset
- **WHEN** um novo caso de avaliação é adicionado a um dataset
- **THEN** a suíte o descobre automaticamente, o tipa com os schemas das tools existentes e o inclui nos relatórios posteriores

### Requirement: Execução condicionada a credencial

A suíte SHALL executar somente quando credencial de provider está configurada; caso contrário SHALL pular com aviso claro. A suíte determinística (`bun run check`) SHALL nunca depender de credencial, rede ou judge de LLM.

#### Scenario: Sem credencial em CI
- **WHEN** o fluxo determinístico executa sem credencial de provider
- **THEN** os evals não rodam, `bun run check` passa normalmente e o usuário vê aviso de que os evals foram pulados

#### Scenario: Gate exige credencial
- **WHEN** o gate de release é executado sem credencial configurada
- **THEN** o gate falha com erro explícito de configuração ausente, em vez de aprovar silenciosamente

### Requirement: Relatórios comparáveis

A suíte SHALL gerar relatório por execução com pontuação por dimensão, casos reprovados, justificativas de judge, hash do dataset e identificação da versão/modelo executado, em formato versionável para comparação entre releases.

#### Scenario: Relatório identificável
- **WHEN** a suíte conclui uma execução
- **THEN** o relatório gerado contém hash determinístico do dataset, modelo/provider usado, timestamp e pontuação de cada caso e dimensão
