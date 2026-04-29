## ADDED Requirements

### Requirement: UI de gerenciamento de módulos em Settings
O sistema SHALL exibir uma seção "Módulos" na tela de configurações do projeto, permitindo que administradores criem, renomeiem e excluam módulos diretamente na interface, sem precisar criar um épico para que o módulo apareça.

#### Scenario: Listar módulos em Settings
- **WHEN** admin acessa a seção "Módulos" em Settings
- **THEN** lista todos os módulos do projeto em ordem de posição, com nome e contagem de épicos vinculados

#### Scenario: Criar módulo em Settings
- **WHEN** admin preenche o nome e clica em "Criar módulo"
- **THEN** módulo é criado via `POST /projects/:id/modules` e aparece na lista imediatamente

#### Scenario: Renomear módulo em Settings
- **WHEN** admin clica em editar e altera o nome do módulo
- **THEN** nome é atualizado via `PATCH /projects/:id/modules/:moduleId`

#### Scenario: Excluir módulo sem épicos
- **WHEN** admin clica em "Excluir" em um módulo sem épicos vinculados
- **THEN** módulo é removido via `DELETE /projects/:id/modules/:moduleId` e desaparece da lista

#### Scenario: Excluir módulo com épicos — confirmação
- **WHEN** admin clica em "Excluir" em um módulo que possui épicos
- **THEN** modal de confirmação exibe a quantidade de épicos afetados e solicita que o admin escolha: mover épicos para outro módulo existente OU excluir o módulo com todos os seus épicos em cascata

#### Scenario: Mover épicos ao excluir módulo
- **WHEN** admin confirma exclusão e seleciona módulo destino para os épicos
- **THEN** épicos têm `moduleId` atualizado para o módulo destino e o módulo original é excluído

---

### Requirement: Endpoint DELETE de módulo
O sistema SHALL fornecer endpoint `DELETE /projects/:id/modules/:moduleId` para remoção de módulos, com suporte a migração de épicos antes da exclusão.

#### Scenario: DELETE módulo sem épicos
- **WHEN** `DELETE /projects/:id/modules/:moduleId` é chamado e o módulo não possui épicos
- **THEN** módulo é removido e retorna 200 // [TENANT] Anti-IDOR verificado

#### Scenario: DELETE módulo com `targetModuleId`
- **WHEN** `DELETE /projects/:id/modules/:moduleId` é chamado com body `{ targetModuleId }` 
- **THEN** épicos do módulo têm `moduleId` atualizado para `targetModuleId`; módulo original é excluído

#### Scenario: DELETE módulo com `cascade: true`
- **WHEN** `DELETE /projects/:id/modules/:moduleId` é chamado com body `{ cascade: true }`
- **THEN** módulo e todos seus épicos (e descendentes) são excluídos em cascata

#### Scenario: DELETE sem body em módulo com épicos
- **WHEN** `DELETE /projects/:id/modules/:moduleId` é chamado sem parâmetros e módulo tem épicos
- **THEN** API retorna 409 com `{ error, epicCount }` solicitando `targetModuleId` ou `cascade`

#### Scenario: VIEWER ou MEMBER não pode excluir módulo
- **WHEN** usuário sem papel ADMIN chama DELETE de módulo
- **THEN** API retorna 403
