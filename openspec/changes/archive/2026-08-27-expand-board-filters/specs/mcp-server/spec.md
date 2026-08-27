## MODIFIED Requirements

### Requirement: Ferramenta create_task no MCP
O sistema SHALL expor ferramenta `create_task` para criação de items respeitando a hierarquia obrigatória EPIC → STORY → TASK/BUG. Para TASK e BUG, a ferramenta SHALL aceitar `versionId` opcional; quando informado, a API SHALL validar que a versão pertence ao projeto e tenant atuais.

#### Scenario: Criação de TASK órfã
- **WHEN** agente invoca `create_task` com `{ projectId, title }` sem `parentId`
- **THEN** sistema cria TASK na primeira coluna do board e retorna o objeto criado com o ID gerado

#### Scenario: Criação respeitando hierarquia completa
- **WHEN** agente cria EPIC (com `moduleId`), depois STORY (com `parentId=epicId`), depois TASK (com `parentId=storyId`)
- **THEN** cada item é criado com vínculo correto e aparece no board dentro da swimlane do EPIC

#### Scenario: Resolução automática de moduleId para EPIC
- **WHEN** agente cria EPIC sem informar `moduleId`
- **THEN** servidor busca automaticamente o primeiro módulo do projeto e o atribui ao EPIC

#### Scenario: Criação de TASK com versão
- **WHEN** agente invoca `create_task` com `type=TASK` ou `type=BUG` e `versionId` de uma versão do projeto
- **THEN** sistema cria o item com `version_id` persistido e retorna a versão associada

#### Scenario: Criação sem versão
- **WHEN** agente invoca `create_task` sem `versionId`
- **THEN** sistema cria o item normalmente com `version_id = null`

#### Scenario: Versão fora do projeto
- **WHEN** agente invoca `create_task` com `versionId` pertencente a outro projeto ou tenant
- **THEN** API rejeita a criação sem persistir o item nem revelar dados da versão

#### Scenario: Violação de hierarquia — TASK filho de EPIC
- **WHEN** agente invoca `create_task` com `type=TASK` e `parentId` apontando para item do tipo EPIC
- **THEN** servidor detecta a violação antes de chamar a API e retorna erro acionável informando o fluxo correto: criar STORY filho do EPIC e usar o ID da STORY como `parentId` da TASK

#### Scenario: Violação de hierarquia — STORY sem pai EPIC
- **WHEN** agente invoca `create_task` com `type=STORY` e `parentId` apontando para item não-EPIC
- **THEN** servidor retorna erro indicando que STORY deve ser filha de EPIC e orienta a usar `list_tasks(type=EPIC)` para obter os IDs disponíveis

#### Scenario: Decisão de granularidade pelo agente
- **WHEN** agente avalia se deve criar subtarefa (TASK filha) ou checklist em card existente
- **THEN** agente considera: subtarefa quando o trabalho é substancial (>30 min), paralelizável ou rastreável individualmente no Kanban; checklist quando os passos são fases sequenciais de uma mesma unidade de trabalho; nenhum registro quando o passo é trivial (<5 min) e não agrega valor ao observador do board
