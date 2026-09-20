## ADDED Requirements

### Requirement: Carregamento sob demanda de dependências pesadas do web

O web SHALL carregar Recharts e Tiptap apenas quando a tela que os utiliza for efetivamente exibida, de modo que o bundle inicial e o bundle de cada rota não contenham essas bibliotecas. O editor de texto rico SHALL incluir somente as extensões Tiptap efetivamente utilizadas.

#### Scenario: Dashboard sem gráficos no chunk inicial

- **WHEN** o usuário carrega qualquer rota que não seja o Dashboard de projeto
- **THEN** o bundle carregado não inclui o código do Recharts

#### Scenario: Gráficos carregados ao abrir o Dashboard

- **WHEN** o usuário abre `/projects/:projectId/dashboard`
- **THEN** os componentes de gráficos são carregados sob demanda e o restante do Dashboard permanece utilizável durante o carregamento

#### Scenario: Editor carregado ao abrir formulário com texto rico

- **WHEN** o usuário abre um modal, accordion ou campo que usa o editor de texto rico
- **THEN** o código do Tiptap é carregado sob demanda e o formulário exibe o estado de carregamento até o editor ficar pronto

#### Scenario: Rota sem editor não carrega Tiptap

- **WHEN** o usuário navega pelo board ou por telas que não abrem o editor de texto rico
- **THEN** o bundle carregado não inclui o código do Tiptap

### Requirement: Medição de bundle reproduzível

O projeto SHALL oferecer um comando de medição de bundle que gera um relatório legível a partir do build de produção do web, sem alterar o resultado do build padrão.

#### Scenario: Comando de análise disponível

- **WHEN** um desenvolvedor executa `bun run build:analyze`
- **THEN** é gerado um relatório do bundle com o tamanho (gzip e bruto) de cada chunk

#### Scenario: Build padrão inalterado

- **WHEN** um desenvolvedor executa o build normal do web
- **THEN** o relatório de análise não é gerado e o conteúdo publicado permanece o mesmo

### Requirement: Orçamento de bundle verificável

O projeto SHALL manter um orçamento de tamanho por chunk do web, versionado no repositório, e SHALL oferecer uma verificação automatizada que falha quando qualquer chunk ultrapassa o limite definido.

#### Scenario: Bundle dentro do orçamento

- **WHEN** a verificação de orçamento é executada sobre um build em que todos os chunks respeitam os limites
- **THEN** a verificação termina com sucesso e reporta os tamanhos medidos

#### Scenario: Chunk acima do orçamento

- **WHEN** algum chunk do web ultrapassa o limite definido para ele
- **THEN** a verificação falha e informa qual chunk estourou, o limite e o valor medido

#### Scenario: Orçamento ausente ou inválido

- **WHEN** o arquivo de orçamento não existe ou está malformado
- **THEN** a verificação falha com mensagem explícita, sem assumir limites implícitos

### Requirement: Gate de bundle no CI

O pipeline de integração contínua SHALL executar a verificação de orçamento de bundle e SHALL reprovar a execução quando o orçamento for ultrapassado.

#### Scenario: Orçamento respeitado no CI

- **WHEN** um push ou pull request gera chunks dentro do orçamento
- **THEN** o passo de orçamento passa e não bloqueia a execução

#### Scenario: Regressão de bundle bloqueia o PR

- **WHEN** um pull request aumenta um chunk acima do orçamento
- **THEN** o passo de orçamento falha e o pull request fica bloqueado
