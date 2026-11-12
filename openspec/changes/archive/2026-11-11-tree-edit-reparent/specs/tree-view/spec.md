# Spec Delta

## ADDED Requirements

### Requirement: Mover itens entre pais na Tree View
O sistema SHALL permitir mover itens entre pais na Tree View por arraste, aplicando o patch de hierarquia correspondente: EPIC para módulo (`moduleId`), STORY para EPIC (`parentId`) e TASK/BUG/EXTERNAL para STORY, TASK ou BUG (`parentId`). O módulo do item movido SHALL acompanhar o módulo do pai de destino. Movimentos que quebrem a hierarquia, criem ciclo ou não alterem o pai SHALL ser recusados sem chamada de mutação. O servidor SHALL revalidar a hierarquia antes de persistir.

#### Scenario: Mover história para outro épico
- **WHEN** o usuário arrasta uma STORY para outro EPIC
- **THEN** a história passa a ter o EPIC de destino como pai e o módulo do EPIC de destino como módulo

#### Scenario: Mover task entre histórias
- **WHEN** o usuário arrasta uma TASK, BUG ou EXTERNAL para outra STORY, TASK ou BUG
- **THEN** o item passa a ter o novo pai e o módulo do pai de destino

#### Scenario: Mover épico para módulo
- **WHEN** o usuário arrasta um EPIC para um módulo
- **THEN** o épico passa a pertencer ao módulo de destino

#### Scenario: Movimento inválido é recusado
- **WHEN** o destino quebraria a hierarquia, é descendente do item arrastado ou é o pai atual
- **THEN** o sistema não envia mutação e a árvore permanece como estava

#### Scenario: Servidor revalida o movimento
- **WHEN** o cliente envia um `parentId` que criaria ciclo ou é incompatível com o tipo
- **THEN** a API rejeita a alteração com erro de hierarquia e a árvore reflete o estado persistido

## MODIFIED Requirements

### Requirement: Editar item pela linha da Tree View
O sistema SHALL exibir um botão de editar em cada linha editável da Tree View e abrir a modal completa de edição do item ao acioná-lo. O ícone de tipo da linha SHALL funcionar como atalho para a mesma edição quando o usuário tiver permissão.

#### Scenario: Abrir edição pela linha
- **WHEN** usuário com permissão de edição clica no botão de editar de uma linha
- **THEN** a modal de edição correspondente abre com os dados atuais do item carregados

#### Scenario: Editar pelo ícone de tipo
- **WHEN** usuário com permissão de edição clica no ícone de tipo de uma linha
- **THEN** a modal de edição do item abre, sem expandir ou colapsar o nó

#### Scenario: Editar e salvar item
- **WHEN** usuário altera campos na modal aberta pela Tree View e clica em "Salvar"
- **THEN** sistema envia as alterações pelo CRUD unificado, fecha ou atualiza a modal conforme o fluxo existente e exibe os valores atualizados na árvore

#### Scenario: Cancelar edição pela árvore
- **WHEN** usuário clica em "Cancelar" ou pressiona Escape na modal
- **THEN** modal fecha e a linha mantém os valores originais sem persistir alterações

#### Scenario: Separar editar de expandir
- **WHEN** usuário clica no botão de editar da linha
- **THEN** o sistema abre somente a edição, sem expandir ou colapsar o nó e sem disparar a seleção da linha

#### Scenario: Ocultar edição para Viewer
- **WHEN** usuário com papel VIEWER acessa uma linha da Tree View
- **THEN** o botão de editar não é exibido ou fica desabilitado e a API rejeita alterações não autorizadas
