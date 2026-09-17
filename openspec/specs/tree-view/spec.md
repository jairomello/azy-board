## Purpose

Definir a Tree View do board, com leitura recursiva dos itens, colunas, filtros, edição inline e criação contextual.

## Requirements

### Requirement: Tree View lê recursivamente da tabela `items`
O sistema SHALL renderizar a Tree View como tabela hierárquica expansível lendo todos os itens de `GET /projects/:id/items/tree`, que retorna a árvore completa EPIC → STORY → TASK/BUG → subtask. A rota `/projects/:id/tree` é substituída por `/projects/:id/items/tree`.

#### Scenario: Alternar para Tree View
- **WHEN** usuário clica no botão "Árvore" no seletor de visualização
- **THEN** board Kanban desaparece e é substituído pela Tree View com dados de `GET /projects/:id/items/tree`

#### Scenario: Estrutura hierárquica exibida
- **WHEN** Tree View é carregada
- **THEN** raiz exibe módulos; cada módulo expande para EPICs; cada EPIC para STORYs; cada STORY para TASK/BUGs; cada TASK/BUG para subtasks (se houver)

#### Scenario: Ícone de tipo em cada nó
- **WHEN** nó é exibido na Tree View
- **THEN** ícone correspondente ao `type` (EPIC, STORY, TASK, BUG) é exibido antes do título do nó

#### Scenario: Expandir e colapsar nós
- **WHEN** usuário clica no ícone de expandir/colapsar de um nó
- **THEN** filhos do nó são exibidos ou ocultados; demais nós permanecem no estado atual

#### Scenario: Botões Expandir tudo / Recolher tudo
- **WHEN** usuário clica em "Expandir tudo"
- **THEN** todos os nós da árvore são expandidos simultaneamente

#### Scenario: Retornar ao Kanban
- **WHEN** usuário clica no botão "Kanban" no seletor de visualização
- **THEN** Tree View é substituída pelo board Kanban com filtros anteriores preservados

---

### Requirement: Colunas de dados na Tree View
O sistema SHALL exibir as seguintes colunas para cada item: Nome (com ícone de tipo), Status, Responsável, Data de Início, Data de Fim, Pontos, Progresso (%). A coluna Progresso SHALL exibir uma barra visual e o percentual numérico calculado para folhas e items agrupadores.

#### Scenario: Progresso de items pai na Tree View
- **WHEN** item pai (EPIC, STORY ou TASK/BUG com filhos) é exibido na Tree View
- **THEN** coluna Progresso exibe porcentagem acumulada calculada pelas folhas TASK/BUG descendentes com barra visual

#### Scenario: Progresso de item folha
- **WHEN** item folha TASK ou BUG é exibido na Tree View
- **THEN** coluna Progresso exibe 100% se o status for DONE e 0% caso contrário

#### Scenario: Status de items folha
- **WHEN** item folha TASK ou BUG é exibido na Tree View
- **THEN** coluna Status exibe o status base atual com indicador visual colorido

#### Scenario: Pontos na Tree View
- **WHEN** item é exibido na Tree View
- **THEN** coluna Pontos exibe o valor da task folha ou a soma calculada para items pai

---

### Requirement: Edição inline na Tree View
O sistema SHALL permitir editar campos diretamente na tabela via `PATCH /projects/:id/items/:id`.

#### Scenario: Edição de título inline
- **WHEN** usuário clica no título de um item na Tree View
- **THEN** título torna-se campo de texto editável in-place

#### Scenario: Alteração de responsável inline
- **WHEN** usuário clica na coluna Responsável de um item
- **THEN** dropdown de membros do projeto é exibido para seleção

---

### Requirement: Filtros na Tree View
O sistema SHALL aplicar os mesmos filtros do Kanban (módulo, sprint, responsável, tags) à Tree View via `GET /projects/:id/items/tree` com os mesmos query params. O progresso SHALL ser recalculado sobre o resultado filtrado.

#### Scenario: Filtro por responsável na Tree View
- **WHEN** usuário seleciona um membro no filtro
- **THEN** Tree View exibe apenas itens atribuídos a esse membro, mantendo a hierarquia visível mas esmaecendo nós sem itens correspondentes

#### Scenario: Progresso reflete filtro na Tree View
- **WHEN** usuário filtra a árvore por sprint ou responsável
- **THEN** barras dos agrupadores refletem somente as folhas que permanecem no resultado filtrado

---

### Requirement: Navegação entre Kanban e Tree View preserva filtros
O sistema SHALL manter os filtros aplicados ao alternar entre Kanban e Tree View.

#### Scenario: Troca de visualização com filtro ativo
- **WHEN** usuário troca de Kanban para Tree View com filtro de módulo ativo
- **THEN** Tree View inicia já filtrada pelo mesmo módulo

---

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
