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
A skill SHALL orientar o agente sobre configuração, descoberta, planejamento, execução, revisão e encerramento usando o catálogo MCP vigente e SHALL incluir as regras de hierarquia EPIC → STORY → TASK/BUG, Leaf Rule, projetos SIMPLE, permissões herdadas, tratamento de erros estruturados, confirmação de mutações por resposta e uso de payloads leves.

#### Scenario: Agente inicia uma tarefa
- **WHEN** o usuário pede trabalho em um projeto sem fornecer contexto suficiente
- **THEN** a skill orienta o agente a descobrir projetos, obter o projeto/board e consultar itens, colunas, sprint e recursos relevantes antes de criar ou modificar cards

#### Scenario: Agente cria trabalho hierárquico
- **WHEN** o agente precisa criar uma TASK ou BUG em projeto HIERARCHICAL
- **THEN** ele consulta os ancestrais necessários, respeita a hierarquia e não cria TASK/BUG diretamente sob EPIC

#### Scenario: Agente confirma mutação sem carga excessiva
- **WHEN** o agente precisa verificar uma alteração em lote
- **THEN** usa a resposta `applied`/`changes` da mutação e, quando precisar consultar itens, usa `list_tasks` com limite, projeção e sem descrições por padrão

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
As guidelines de contribuição SHALL exigir que toda mudança avalie impacto sobre a skill oficial e atualize seus arquivos, comandos, referências ou verificador quando alterar ferramentas MCP, contratos AI/API, fluxos operacionais, segurança ou documentação consumida por agentes. Mudanças de payload default, retry e operação semântica SHALL incluir exemplos mínimos na skill.

#### Scenario: Mudança altera ferramenta MCP
- **WHEN** uma contribuição adiciona, remove, renomeia ou altera entrada/saída de ferramenta MCP
- **THEN** a contribuição inclui a avaliação e adequação correspondente da skill, seus comandos e referências, além dos testes de contrato aplicáveis

#### Scenario: Mudança não afeta a skill
- **WHEN** uma contribuição não altera nenhum contrato, fluxo ou documentação consumida por agentes
- **THEN** o autor registra explicitamente no PR que avaliou o impacto e justifica por que nenhuma atualização da skill é necessária

### Requirement: Recuperação de chamadas e erros acionáveis
A skill SHALL orientar o agente a repetir uma única vez, de forma isolada, uma chamada que falhou por JSON inválido; em erro persistente, SHALL reportar a ferramenta, o caminho inválido e a forma mínima aceita. O agente SHALL usar `retryable` para decidir retries de API e NÃO SHALL repetir validação, autorização ou conflito permanentes.

#### Scenario: Retry isolado de JSON inválido
- **WHEN** a chamada MCP falha antes da execução por JSON inválido
- **THEN** o agente repete a mesma intenção em uma chamada isolada, sem paralelismo, no máximo uma vez

#### Scenario: Erro persistente
- **WHEN** a segunda tentativa isolada falha pelo mesmo motivo
- **THEN** o agente para, apresenta a mensagem acionável e não afirma que a mutação foi realizada

### Requirement: Fluxo semântico e em lote de checklist
A skill SHALL documentar a resolução por `checklistName` + texto/posição, a exigência de IDs em caso ambíguo e o limite/atomicidade da ferramenta `check_items`. O caminho por IDs SHALL continuar documentado como fallback determinístico.

#### Scenario: Marcar vários passos
- **WHEN** o agente precisa marcar vários passos do mesmo card
- **THEN** prefere `check_items` dentro do limite, tratando a resposta agregada e os conflitos por operação

#### Scenario: Texto ambíguo
- **WHEN** a resolução semântica encontra mais de um passo compatível
- **THEN** o agente não escolhe arbitrariamente e repete com IDs ou `position`

---

### Requirement: Autoconfiguração do MCP pelo agente do usuário
A skill oficial SHALL orientar o agente a configurar o servidor MCP do Azy Board no cliente do usuário (Claude Code, Codex, OpenCode e outros) a partir de um pedido em linguagem natural, cobrindo: pré-requisitos, obtenção e uso seguro da API Key, estrutura de configuração do servidor `azy-board` e verificação da conexão. O roteiro SHALL usar placeholders e NÃO SHALL conter segredos, hosts privados ou credenciais reais.

#### Scenario: Usuário pede para configurar o MCP
- **WHEN** o usuário pede ao agente, com a skill carregada, que ajude a configurar o MCP do Azy Board no seu code agent
- **THEN** o agente explica os pré-requisitos, como gerar a API Key em Minha conta, qual estrutura de configuração registrar no cliente e como verificar a conexão, adaptando ao cliente informado

#### Scenario: Credencial nunca em arquivo versionado
- **WHEN** o agente monta a configuração para o usuário
- **THEN** usa `azb_sua_chave_aqui` como placeholder, orienta a manter a chave em variável de ambiente ou cofre do cliente e alerta para não gravá-la em arquivo versionado

#### Scenario: Verificação após configurar
- **WHEN** a configuração foi aplicada e o cliente recarregado
- **THEN** o agente orienta a confirmar que o servidor iniciou sem erro e que `list_tasks` e `list_modules` aparecem e respondem para um projeto acessível

#### Scenario: Comando semântico de configuração
- **WHEN** o usuário invoca o comando semântico de configuração do MCP (ou o equivalente em linguagem natural)
- **THEN** o agente segue o roteiro de configuração sem exigir que o cliente suporte slash commands

### Requirement: Segurança da credencial na configuração do MCP
O roteiro de configuração SHALL deixar explícito que a API Key identifica um Owner humano, que cada cliente e ambiente usa uma chave própria, que a chave exposta deve ser revogada e que `AZYBOARD_PROJECT_ID` não é segredo e pode ficar versionado, ao contrário da chave.

#### Scenario: Chave exposta
- **WHEN** o usuário relata que colou a chave em um arquivo versionado ou a compartilhou
- **THEN** o agente orienta a revogar a chave em Minha conta, gerar uma nova e movê-la para variável de ambiente ou cofre do cliente
