# frontend-testing Specification

## Purpose

Definir a estratégia e a infraestrutura de testes do frontend web, cobrindo comportamento sem DOM, testes de componente com DOM, E2E de navegador para jornadas críticas, a jornada determinística do Azy Agent, regressão visual e a política de uso de testes de contrato estrutural.

## Requirements

### Requirement: Testes de comportamento da lógica de frontend
O frontend web SHALL testar o comportamento observável de hooks, adapters e regras de negócio sem depender de DOM nem de navegador. A lógica testável SHALL residir em módulos sem dependência direta de React, de modo que possa ser exercitada com entradas e dependências injetadas. Os testes SHALL verificar resultados e efeitos observáveis (estado resultante, payloads emitidos, erros propagados), e não a presença de trechos no código-fonte.

#### Scenario: Regra de negócio exercitada como comportamento
- **WHEN** um módulo de lógica do frontend recebe uma entrada e dependências simuladas
- **THEN** o teste verifica o resultado observável e os efeitos emitidos, sem inspecionar o texto do arquivo-fonte

#### Scenario: Refatoração semanticamente neutra não quebra o teste
- **WHEN** a implementação de um módulo é refatorada preservando o comportamento
- **THEN** os testes de comportamento continuam passando

#### Scenario: Implementação incorreta é detectada
- **WHEN** um módulo passa a produzir um resultado ou efeito incorreto mantendo a mesma estrutura textual
- **THEN** ao menos um teste de comportamento falha

### Requirement: Testes de componente com DOM e interação
O frontend web SHALL dispor de infraestrutura de DOM para testar componentes React renderizados, cobrindo renderização condicional, interação do usuário e acessibilidade. A infraestrutura SHALL usar dependências com licença MIT, Apache 2.0, BSD, ISC ou domínio público, e SHALL ser registrada apenas nos testes que dela precisam, sem injetar globais de DOM nos testes de backend ou MCP.

#### Scenario: Componente renderizado e consultado por papel acessível
- **WHEN** um teste de componente renderiza um componente com DOM disponível
- **THEN** o teste encontra elementos por papel e rótulo acessível e verifica o resultado da interação

#### Scenario: Interação do usuário altera o estado da interface
- **WHEN** o teste simula clique, digitação ou seleção em um controle
- **THEN** o componente reflete a mudança de estado esperada na árvore renderizada

#### Scenario: Testes de backend não recebem globais de DOM
- **WHEN** a suíte de testes de API ou MCP é executada
- **THEN** nenhum global de DOM é registrado por causa da infraestrutura de testes de componente

### Requirement: E2E de navegador para jornadas críticas
O projeto SHALL manter uma suíte E2E de navegador, executável por comando único, que sobe um stack descartável (banco temporário, API e web) e cobre, no mínimo, as jornadas de login, Board (criar card, mover entre colunas e reordenar por arrastar), Settings (excluir coluna, squad e módulo) e permissões por papel. A suíte SHALL ser determinística, usar esperas por estado observável em vez de pausas fixas e derrubar o stack ao final, sem tocar o banco de desenvolvimento.

#### Scenario: Jornada de login
- **WHEN** a suíte executa a jornada de login com credenciais válidas
- **THEN** a sessão é estabelecida e a aplicação navega para a listagem de projetos

#### Scenario: Jornada de Board com arrastar
- **WHEN** a suíte cria um card, o move para outra coluna e reordena por arrastar
- **THEN** a nova posição e a nova coluna persistem após a operação

#### Scenario: Jornada de Settings
- **WHEN** a suíte exclui uma coluna, um squad e um módulo pelas configurações
- **THEN** os itens deixam de aparecer sem erro exibido ao usuário

#### Scenario: Jornada de permissões
- **WHEN** a suíte autentica com um papel sem permissão administrativa e tenta acessar a área restrita
- **THEN** a interface bloqueia a ação conforme o papel do usuário

#### Scenario: Stack descartável e isolado
- **WHEN** a suíte E2E é iniciada
- **THEN** ela usa banco temporário, não altera o banco de desenvolvimento e encerra todos os processos ao final

### Requirement: Jornada determinística do Azy Agent no E2E
A suíte E2E SHALL cobrir a jornada do Azy Agent na interface sem chamar provider de LLM real, usando um provider determinístico habilitado apenas em modo de teste. O provider de teste SHALL ser inacessível quando a aplicação roda em produção.

#### Scenario: Interação com o agente sem LLM real
- **WHEN** a suíte abre o agente e envia uma mensagem em modo de teste
- **THEN** a resposta determinística é exibida e nenhuma chamada a provider externo é feita

#### Scenario: Provider de teste indisponível em produção
- **WHEN** a aplicação é iniciada com ambiente de produção
- **THEN** o provider determinístico de teste não pode ser selecionado

### Requirement: Regressão visual das telas críticas
O projeto SHALL manter uma verificação de regressão visual para um conjunto estável de telas críticas (no mínimo login, listagem de projetos, Board, Settings e dashboard), comparando screenshots contra baselines versionados. A verificação SHALL usar viewport e tema fixos, dados de seed determinísticos, tolerância explícita de diferença e um comando dedicado para regenerar baselines.

#### Scenario: Tela sem alteração visual passa
- **WHEN** uma tela do conjunto estável é capturada e corresponde à baseline dentro da tolerância
- **THEN** a verificação de regressão visual é considerada bem-sucedida

#### Scenario: Alteração visual inesperada é sinalizada
- **WHEN** uma tela do conjunto estável sofre alteração visual além da tolerância
- **THEN** a verificação falha e a diferença é registrada como artefato

#### Scenario: Regeneração explícita de baselines
- **WHEN** o desenvolvedor executa o comando de regeneração de baselines no ambiente controlado
- **THEN** as baselines são atualizadas de forma intencional e versionadas

### Requirement: Política de testes de contrato estrutural
O projeto SHALL restringir testes que apenas verificam a presença de trechos no código-fonte. Um teste desse tipo SHALL existir somente quando verificar um invariante não comportamental (por exemplo, cobertura de chaves de i18n ou fronteiras entre módulos), SHALL conter comentário justificando a impossibilidade de um teste comportamental equivalente e SHALL NOT ser usado como substituto de verificação de comportamento.

#### Scenario: Contrato estrutural justificado é permitido
- **WHEN** um teste verifica um invariante não comportamental com justificativa registrada no arquivo
- **THEN** o teste é aceito e mantido

#### Scenario: Contrato estrutural sem justificativa é rejeitado
- **WHEN** é adicionado um teste que apenas lê o código-fonte e busca uma string, sem justificativa de invariante não comportamental
- **THEN** a verificação sinaliza o teste para revisão ou remoção

#### Scenario: Migração preserva cobertura
- **WHEN** um teste de contrato estrutural é substituído por um teste de comportamento
- **THEN** o contrato estrutural só é removido depois que o teste substituto está verde

### Requirement: Execução e documentação da suíte de frontend
O projeto SHALL disponibilizar comandos únicos para executar a suíte de frontend e o E2E de navegador, e SHALL documentar a estratégia, os comandos e a política de contratos estruturais em `TESTING.md`.

#### Scenario: Suíte de frontend executável por comando único
- **WHEN** o desenvolvedor executa o comando da suíte de frontend
- **THEN** os testes de comportamento e de componente são executados e reportam sucesso ou falha

#### Scenario: E2E executável por comando único
- **WHEN** o desenvolvedor executa o comando de E2E
- **THEN** o stack descartável é preparado, as jornadas são executadas e um resumo é apresentado

#### Scenario: Estratégia documentada
- **WHEN** o desenvolvedor consulta `TESTING.md`
- **THEN** encontra os níveis de teste, os comandos, os pré-requisitos do E2E e a política de testes de contrato estrutural
