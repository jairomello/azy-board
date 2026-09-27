## MODIFIED Requirements

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

### Requirement: Impacto da skill em mudanças do projeto

As guidelines de contribuição SHALL exigir que toda mudança avalie impacto sobre a skill oficial e atualize seus arquivos, comandos, referências ou verificador quando alterar ferramentas MCP, contratos AI/API, fluxos operacionais, segurança ou documentação consumida por agentes. Mudanças de payload default, retry e operação semântica SHALL incluir exemplos mínimos na skill.

#### Scenario: Mudança altera ferramenta MCP

- **WHEN** uma contribuição adiciona, remove, renomeia ou altera entrada/saída de ferramenta MCP
- **THEN** a contribuição inclui a avaliação e adequação correspondente da skill, seus comandos e referências, além dos testes de contrato aplicáveis

#### Scenario: Mudança não afeta a skill

- **WHEN** uma contribuição não altera nenhum contrato, fluxo ou documentação consumida por agentes
- **THEN** o autor registra explicitamente no PR que avaliou o impacto e justifica por que nenhuma atualização da skill é necessária

## ADDED Requirements

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
