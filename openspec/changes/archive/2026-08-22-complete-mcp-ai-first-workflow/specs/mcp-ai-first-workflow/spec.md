## ADDED Requirements

### Requirement: Fluxo completo de gerenciamento por MCP

O servidor MCP SHALL permitir que um code agent descubra e opere projetos, configurações, estrutura, equipe, planejamento e execução sem precisar montar chamadas REST manualmente. As ferramentas SHALL funcionar em projetos `SIMPLE` e `HIERARCHICAL` respeitando o modo retornado pelo projeto.

#### Scenario: Agente descobre projetos disponíveis
- **WHEN** agente invoca `list_projects`
- **THEN** servidor retorna somente projetos do tenant e com membership do Owner da API Key, incluindo `id`, `name`, `boardMode` e papel efetivo

#### Scenario: Agente consulta o estado do projeto
- **WHEN** agente invoca `get_project` ou `get_board` com `projectId`
- **THEN** servidor retorna configuração, colunas, modo, STORY fixa quando aplicável e itens em formato estruturado adequado para planejamento

#### Scenario: Agente configura projeto completo
- **WHEN** agente invoca ferramentas de projeto, módulos, colunas, sprints, tags, versões, membros, squads ou centros de custo
- **THEN** cada ferramenta executa a operação correspondente, retorna o recurso atualizado e aplica as permissões do Owner

#### Scenario: Agente executa trabalho
- **WHEN** agente precisa criar, consultar, atualizar, atribuir, mover, ordenar, concluir, arquivar, restaurar ou excluir items
- **THEN** servidor oferece ferramentas específicas com todos os campos suportados, valida o estado e retorna resultado acionável

#### Scenario: Agente usa evidências do trabalho
- **WHEN** agente precisa operar checklists ou logs de um item
- **THEN** servidor oferece leitura e mutações necessárias sem expor caminhos internos, segredos ou dados de outro projeto

#### Scenario: Upload via IA não está disponível
- **WHEN** agente tenta enviar arquivo ou fazer upload de anexo pelo MCP
- **THEN** servidor informa que upload via IA não é suportado nesta versão e não persiste o conteúdo

### Requirement: Ferramentas seguras e previsíveis para agentes

Toda ferramenta MCP SHALL validar entradas em runtime, exigir IDs e valores válidos, aplicar limites de paginação/payload e retornar erros com código estável, mensagem segura e indicação de retry quando aplicável.

#### Scenario: Entrada inválida
- **WHEN** agente envia campo obrigatório ausente, enum inválido, ID vazio, paginação fora do limite ou texto acima do limite
- **THEN** servidor rejeita a chamada antes da API com erro estruturado não-retryable e orientação de correção

#### Scenario: Recurso não encontrado
- **WHEN** agente informa recurso inexistente ou fora de seu escopo
- **THEN** servidor retorna erro estruturado sem stack trace, SQL, tenant ou informação que revele recurso de terceiros

#### Scenario: Mutação repetida com idempotência
- **WHEN** agente repete uma mutação com a mesma `idempotencyKey` e payload equivalente
- **THEN** servidor retorna o mesmo resultado lógico sem criar duplicação

#### Scenario: Operação em lote
- **WHEN** agente envia uma operação batch dentro do limite permitido
- **THEN** servidor retorna resultado por item com sucesso, erro e código de cada entrada, respeitando `atomic=false` por padrão ou desfazendo todo o lote quando `atomic=true`

### Requirement: Compatibilidade com projetos simples

As ferramentas MCP SHALL consultar o `boardMode` antes de exigir estrutura hierárquica. Em projeto `SIMPLE`, criação de TASK/BUG SHALL usar a STORY fixa automaticamente e ferramentas de módulo/EPIC SHALL retornar estado explícito quando não forem aplicáveis.

#### Scenario: Criar task em projeto simples
- **WHEN** agente invoca `create_task` para projeto `SIMPLE` sem `moduleId` ou `parentId`
- **THEN** servidor cria o card na STORY fixa e retorna `simpleStoryId`/`parentId` efetivo

#### Scenario: Agente consulta árvore simples
- **WHEN** agente invoca `get_tree` para projeto `SIMPLE`
- **THEN** servidor retorna a STORY fixa e seus cards sem fabricar módulos ou EPICs

#### Scenario: Operação hierárquica não aplicável
- **WHEN** agente tenta criar um EPIC em projeto `SIMPLE` sem solicitar conversão
- **THEN** servidor retorna erro estruturado informando o modo atual e a ferramenta/fluxo adequado

### Requirement: Regressão e contrato do catálogo MCP

O projeto SHALL testar o registro das ferramentas, seus schemas de entrada, handlers, respostas e documentação contra uma API isolada, sem depender de credenciais reais ou servidor externo.

#### Scenario: Ferramenta registrada possui implementação
- **WHEN** a suíte enumera ferramentas do servidor MCP
- **THEN** cada ferramenta registrada possui handler, schema válido, teste de sucesso e teste de erro

#### Scenario: Documentação acompanha o catálogo
- **WHEN** a suíte compara README e catálogo MCP
- **THEN** não existem ferramentas documentadas que não estejam registradas nem ferramentas registradas sem documentação mínima

#### Scenario: Integração sem segredo real
- **WHEN** a suíte de integração executa em SQLite isolado
- **THEN** cobre múltiplos tenants, projetos e papéis usando fixtures temporárias, sem ler `.env` ou API Keys reais
