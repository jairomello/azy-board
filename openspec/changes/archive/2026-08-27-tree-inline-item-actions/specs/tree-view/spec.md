## ADDED Requirements

### Requirement: Ações visíveis de criação na Tree View
O sistema SHALL exibir na Tree View ações visíveis para criar Módulo, EPIC, STORY, TASK e BUG, usando os fluxos de criação existentes e respeitando as permissões do usuário.

#### Scenario: Exibir ações de criação
- **WHEN** usuário com permissão de criação acessa a Tree View
- **THEN** a área de ações exibe botões identificáveis para Módulo, Épico, História, Task e Bug

#### Scenario: Criar item a partir da árvore
- **WHEN** usuário clica em uma ação de criação
- **THEN** o sistema abre o formulário ou modal de criação correspondente sem exigir a troca para o Kanban

#### Scenario: Ocultar criação para Viewer
- **WHEN** usuário com papel VIEWER acessa a Tree View
- **THEN** ações de criação não são exibidas ou ficam desabilitadas e nenhuma criação é permitida

### Requirement: Criação contextual pelo nó da árvore
O sistema SHALL permitir iniciar a criação diretamente a partir de um nó da Tree View, preenchendo o contexto de módulo e o `parentId` compatível com a hierarquia do item.

#### Scenario: Criar filho de um nó
- **WHEN** usuário abre a ação de adicionar em um EPIC, STORY ou TASK/BUG
- **THEN** o modal correspondente é aberto com o nó atual preenchido como pai quando o tipo escolhido for válido para aquele pai

#### Scenario: Impedir tipo incompatível
- **WHEN** usuário tenta escolher um tipo que não pode ser filho do nó atual
- **THEN** a ação desse tipo não é exibida ou fica desabilitada, e a API rejeita qualquer tentativa inválida

#### Scenario: Criar módulo ou épico no nível raiz
- **WHEN** usuário inicia a criação de Módulo ou EPIC pela ação de nível raiz
- **THEN** o modal abre sem `parentId` e, no caso do EPIC, preserva o `moduleId` selecionado quando houver

### Requirement: Editar item pela linha da Tree View
O sistema SHALL exibir um botão de editar em cada linha editável da Tree View e abrir a modal completa de edição do item ao acioná-lo.

#### Scenario: Abrir edição pela linha
- **WHEN** usuário com permissão de edição clica no botão de editar de uma linha
- **THEN** a modal de edição correspondente abre com os dados atuais do item carregados

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

### Requirement: Atualizar a Tree View após ações
O sistema SHALL atualizar os dados e os valores calculados da Tree View após criação ou edição concluída, preservando filtros e o estado de expansão quando os nós ainda existirem.

#### Scenario: Item criado aparece na árvore
- **WHEN** criação de item é concluída com sucesso
- **THEN** o novo item aparece no pai correspondente ou no nível raiz, e a árvore recalcula progresso e pontos afetados

#### Scenario: Item editado atualiza a árvore
- **WHEN** edição de item é concluída com sucesso
- **THEN** a linha exibe os dados novos e os agregadores ancestrais refletem os valores recalculados

#### Scenario: Falha na mutação
- **WHEN** API retorna erro ao criar ou editar
- **THEN** sistema mantém os dados anteriores, informa o erro ao usuário e não apresenta a operação como concluída
