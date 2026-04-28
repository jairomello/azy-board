## MODIFIED Requirements

### Requirement: Épicos são items com `type = EPIC` na tabela `items`
O sistema SHALL tratar épicos como items regulares com `type = EPIC`, `moduleId` obrigatório e `parentId = null`. A tabela `epics` é removida. Todos os endpoints e queries que liam de `epics` passam a ler de `items?type=EPIC`.

#### Scenario: Criação de épico via endpoint unificado
- **WHEN** membro cria um épico via `POST /projects/:id/items` com `type = EPIC` e `moduleId` válido
- **THEN** sistema registra o item sem `parentId`, com `moduleId` preenchido e posição na lista de EPICs do módulo

#### Scenario: Épico sem módulo usa módulo padrão
- **WHEN** projeto não possui módulos criados e usuário cria um épico
- **THEN** sistema usa o módulo padrão "Geral" como `moduleId` do épico automaticamente

---

### Requirement: Swimlanes colapsáveis por EPIC com progresso
O sistema SHALL exibir swimlanes no board agrupadas por items com `type = EPIC`. Progresso e pontos são calculados com base nos items TASK/BUG folha descendentes.

#### Scenario: Progresso do EPIC calculado via descendentes folha
- **WHEN** swimlane de EPIC é exibida
- **THEN** header exibe `(items TASK/BUG folha com status DONE / total items TASK/BUG folha) * 100` como porcentagem com barra visual

#### Scenario: Pontos totais do EPIC no header
- **WHEN** swimlane de EPIC é exibida
- **THEN** header exibe a soma dos `points` de todos os items TASK/BUG folha descendentes do EPIC

#### Scenario: Colapsar swimlane de EPIC
- **WHEN** usuário clica no header da swimlane
- **THEN** raia colapsa exibindo apenas título do EPIC, progresso e contagem de cards por coluna

---

### Requirement: Hierarquia do EPIC reflete agrupamento por módulo
O sistema SHALL garantir que EPICs com o mesmo `moduleId` aparecem agrupados no board quando o filtro de módulo está ativo.

#### Scenario: Filtrar board por módulo
- **WHEN** usuário seleciona um módulo no filtro do board
- **THEN** apenas swimlanes de EPICs com `moduleId` igual ao módulo selecionado são exibidas
