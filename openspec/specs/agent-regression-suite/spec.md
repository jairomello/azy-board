## Purpose

Definir a suíte determinística de regressão dos fluxos de mutação do Azy Agent.

## Requirements

### Requirement: Suíte recorrente de regressão do agente

O projeto SHALL manter uma suíte determinística de regressão executada pelo fluxo padrão de testes, cobrindo os principais fluxos de mutação do Azy Agent sem credenciais ou provedor externo.

#### Scenario: Criação de projeto com dados mínimos
- **WHEN** o agente chama a operação de criação de projeto informando somente o nome
- **THEN** a suíte confirma que o projeto é criado com defaults válidos, usuário autenticado como responsável/gerente quando aplicável e sem solicitar campos opcionais

#### Scenario: Criação de projeto com todos os dados
- **WHEN** o agente cria um projeto informando nome, descrição e modo hierárquico
- **THEN** a suíte confirma que todos os valores são persistidos e que o projeto recebe sua configuração inicial completa

#### Scenario: Criação individual de hierarquia
- **WHEN** o agente cria EPICs, STORYs, TASKs e subtasks em ordem, informando os pais válidos
- **THEN** a suíte confirma tipos, títulos, pais, `ancestryPath`, status inicial, pontos, prioridade e responsável do usuário logado

#### Scenario: Criação hierárquica em lote
- **WHEN** o agente envia EPICs, STORYs e TASKs em uma operação batch usando `ref` e `parentRef`
- **THEN** a suíte confirma a ordem, resolução dos pais, módulo por nome, atribuição, status e atomicidade do resultado

#### Scenario: Atualização em lote de datas por critério
- **WHEN** o agente usa filtros para alterar datas de todos os cards que atendem ao critério
- **THEN** somente os cards selecionados recebem a operação de data e os demais permanecem inalterados

#### Scenario: Atualização em lote de responsáveis por critério
- **WHEN** o agente altera o responsável de todas as TASKs selecionadas por filtros
- **THEN** somente TASKs elegíveis são atualizadas para o usuário resolvido e a operação não afeta outros tipos

#### Scenario: Movimentação e reparenting de tasks
- **WHEN** o agente move TASKs entre listas/colunas ou muda seu pai para uma STORY/EPIC válida conforme a regra de hierarquia
- **THEN** a suíte confirma a coluna, o novo pai, a ancestry, a Leaf Rule e a rejeição de relações inválidas

#### Scenario: Execução automática da regressão
- **WHEN** alguém executa `bun test` ou `bun run check`
- **THEN** todos os cenários da suíte são descobertos, executados e fazem a verificação falhar se qualquer contrato deixar de ser atendido
