## Purpose

Definir a skill oficial, distribuível e agnóstica de cliente para orientar agentes no uso do Azy Board pelo MCP.

## Requirements

### Requirement: Skill oficial canônica para agentes
O repositório SHALL manter uma skill oficial em diretório neutro, com um arquivo de entrada e referências versionadas, para orientar code agents a operar o Azy Board pelo MCP sem depender de instruções fora do repositório.

#### Scenario: Agente carrega a skill
- **WHEN** um cliente compatível carrega o arquivo de entrada da skill
- **THEN** o agente recebe o objetivo da integração, o fluxo de descoberta de contexto, as regras de segurança e referências para os playbooks detalhados

#### Scenario: Skill não contém segredo
- **WHEN** a skill é revisada ou distribuída
- **THEN** seus exemplos usam placeholders e não contêm API Keys, tokens, hosts privados ou credenciais reais

### Requirement: Orientação operacional alinhada ao MCP
A skill SHALL orientar o agente sobre configuração, descoberta, planejamento, execução, revisão e encerramento usando o catálogo MCP vigente e SHALL incluir as regras de hierarquia EPIC → STORY → TASK/BUG, Leaf Rule, projetos SIMPLE, permissões herdadas e tratamento de erros estruturados.

#### Scenario: Agente inicia uma tarefa
- **WHEN** o usuário pede trabalho em um projeto sem fornecer contexto suficiente
- **THEN** a skill orienta o agente a descobrir projetos, obter o projeto/board e consultar itens, colunas, sprint e recursos relevantes antes de criar ou modificar cards

#### Scenario: Agente cria trabalho hierárquico
- **WHEN** o agente precisa criar uma TASK ou BUG em projeto HIERARCHICAL
- **THEN** ele consulta os ancestrais necessários, respeita a hierarquia e não cria TASK/BUG diretamente sob EPIC

#### Scenario: Agente executa ação destrutiva
- **WHEN** o agente pretende excluir ou arquivar projeto ou item em cascata
- **THEN** ele usa preview/dry-run quando disponível, valida o resultado e solicita confirmação antes da operação irreversível

### Requirement: Slash commands distribuíveis
A skill SHALL definir comandos de operação do Azy Board em formato semântico e SHALL fornecer instruções ou adaptadores para expô-los como slash commands nos clientes que suportarem esse mecanismo.

#### Scenario: Usuário invoca comando de status
- **WHEN** o usuário chama o comando de consulta de status do Azy Board
- **THEN** o agente lê o contexto autorizado pelo MCP, resume board/sprint/trabalho relevante e não altera dados

#### Scenario: Cliente não suporta slash commands
- **WHEN** a skill é instalada em cliente sem mecanismo de comandos
- **THEN** o conteúdo semântico continua utilizável por linguagem natural sem exigir arquivos específicos daquele cliente

### Requirement: Verificação de sincronização da skill
O projeto SHALL possuir uma verificação automatizada e sem credenciais reais que detecte divergências entre ferramentas MCP/comandos/referências documentados na skill e o catálogo oficial do servidor.

#### Scenario: Catálogo e skill estão alinhados
- **WHEN** o verificador é executado contra o catálogo vigente
- **THEN** ele termina com sucesso e confirma que as ferramentas e comandos obrigatórios estão presentes

#### Scenario: Ferramenta MCP nova não foi documentada
- **WHEN** o catálogo contém ferramenta ou contrato obrigatório ausente da skill
- **THEN** o verificador falha com mensagem acionável identificando a divergência

### Requirement: Impacto da skill em mudanças do projeto
As guidelines de contribuição SHALL exigir que toda mudança avalie impacto sobre a skill oficial e atualize seus arquivos, comandos, referências ou verificador quando alterar ferramentas MCP, contratos AI/API, fluxos operacionais, segurança ou documentação consumida por agentes.

#### Scenario: Mudança altera ferramenta MCP
- **WHEN** uma contribuição adiciona, remove, renomeia ou altera entrada/saída de ferramenta MCP
- **THEN** a contribuição inclui a avaliação e adequação correspondente da skill, seus comandos e referências, além dos testes de contrato aplicáveis

#### Scenario: Mudança não afeta a skill
- **WHEN** uma contribuição não altera nenhum contrato, fluxo ou documentação consumida por agentes
- **THEN** o autor registra explicitamente no PR que avaliou o impacto e justifica por que nenhuma atualização da skill é necessária
