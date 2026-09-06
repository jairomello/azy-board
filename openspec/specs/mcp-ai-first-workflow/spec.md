## Purpose

Definir os requisitos da capacidade mcp ai first workflow.

## Requirements

### Requirement: Fluxo completo de gerenciamento por MCP

O servidor MCP SHALL permitir que um code agent descubra e opere projetos, configurações, estrutura, equipe, planejamento e execução sem precisar montar chamadas REST manualmente. As ferramentas SHALL funcionar em projetos `SIMPLE` e `HIERARCHICAL` respeitando o modo retornado pelo projeto, aplicar permissões efetivas do Owner da API Key e `create_task` SHALL aceitar `versionId` opcional preservando o vínculo informado.

#### Scenario: Agente descobre projetos disponíveis
- **WHEN** agente invoca `list_projects`
- **THEN** servidor retorna somente projetos permitidos pelo grupo e membership do Owner no tenant, também limitados pelo escopo da API Key, incluindo `id`, `name`, `boardMode` e papel efetivo

#### Scenario: Agente consulta o estado do projeto
- **WHEN** agente invoca `get_project` ou `get_board` com `projectId`
- **THEN** servidor retorna configuração, colunas, modo, STORY fixa quando aplicável e itens permitidos pelo Owner

#### Scenario: Agente cria item versionado
- **WHEN** agente invoca `create_task` com `versionId` pertencente ao projeto
- **THEN** servidor cria TASK/BUG com o vínculo de versão e retorna o item atualizado

#### Scenario: Agente cria item sem versão
- **WHEN** agente invoca `create_task` sem `versionId`
- **THEN** servidor cria o item normalmente sem vínculo de versão

#### Scenario: Versão inválida na criação
- **WHEN** agente invoca `create_task` com `versionId` de outro projeto ou tenant
- **THEN** servidor rejeita a chamada antes de criar o item

#### Scenario: Agente configura projeto completo
- **WHEN** agente invoca ferramentas de projeto, módulos, colunas, sprints, tags, versões, membros, squads ou centros de custo
- **THEN** cada ferramenta verifica o grupo e o papel local do Owner antes de executar, retornando 403 sem mutação quando não autorizado

#### Scenario: Agente executa trabalho
- **WHEN** agente precisa criar, consultar, atualizar, atribuir, mover, ordenar, concluir, arquivar, restaurar ou excluir items
- **THEN** servidor oferece ferramentas específicas com todos os campos suportados, valida o estado e aplica o papel local e o escopo efetivos do Owner

#### Scenario: Upload via IA não está disponível
- **WHEN** agente tenta enviar arquivo ou fazer upload de anexo pelo MCP
- **THEN** servidor informa que upload via IA não é suportado nesta versão e não persiste o conteúdo

### Requirement: Ferramentas seguras e previsíveis para agentes

Toda ferramenta MCP SHALL validar entradas em runtime, exigir IDs e valores válidos, aplicar limites de paginação/payload e retornar erros com código estável, mensagem segura e indicação de retry quando aplicável.

#### Scenario: Entrada inválida
- **WHEN** agente envia campo obrigatório ausente, enum inválido, ID vazio, paginação fora do limite ou texto acima do limite
- **THEN** servidor rejeita a chamada antes da API com erro estruturado não-retryable

#### Scenario: Mutação repetida com idempotência
- **WHEN** agente repete uma mutação com a mesma `idempotencyKey` e payload equivalente
- **THEN** servidor retorna o mesmo resultado lógico sem criar duplicação

#### Scenario: Operação em lote
- **WHEN** agente envia uma operação batch dentro do limite permitido
- **THEN** servidor retorna resultado por item, usando `atomic=false` por padrão ou desfazendo todo o lote quando `atomic=true`

### Requirement: Compatibilidade com projetos simples

As ferramentas MCP SHALL consultar o `boardMode` antes de exigir estrutura hierárquica. Em projeto `SIMPLE`, criação de TASK/BUG SHALL usar a STORY fixa automaticamente e ferramentas de módulo/EPIC SHALL retornar estado explícito quando não forem aplicáveis.

#### Scenario: Criar task em projeto simples
- **WHEN** agente invoca `create_task` para projeto `SIMPLE` sem `moduleId` ou `parentId`
- **THEN** servidor cria o card na STORY fixa e retorna o `parentId` efetivo

### Requirement: Regressão e contrato do catálogo MCP

O projeto SHALL testar o registro das ferramentas, seus schemas, handlers, respostas, documentação e os fluxos recorrentes de mutação contra uma API isolada, sem depender de credenciais reais ou servidor externo. A regressão SHALL incluir criação mínima e completa de projeto, hierarquia individual e em lote, atualizações em lote por filtros e movimentação/reparenting de tasks.

#### Scenario: Catálogo documentado
- **WHEN** a suíte compara o catálogo MCP com o README
- **THEN** não existem ferramentas registradas sem documentação mínima nem ferramentas documentadas inexistentes

#### Scenario: Fluxos recorrentes preservados
- **WHEN** uma alteração estrutural é validada pelo comando padrão do projeto
- **THEN** os testes confirmam que as tools de projeto, criação hierárquica, batch, atualização filtrada e movimentação continuam aceitando os contratos esperados e retornando erros estáveis quando inválidos
