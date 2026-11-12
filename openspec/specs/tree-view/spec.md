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
O sistema SHALL exibir as seguintes colunas para cada item: Nome (com ícone de tipo), Status, Responsável, Data de Início, Data de Fim, Pontos, Progresso (%) e Dependências. A coluna Progresso SHALL exibir uma barra visual e o percentual numérico calculado para folhas e items agrupadores. A coluna Dependências SHALL listar os itens dos quais a linha depende, identificados pelo `sequenceCode` (com fallback para o título quando ausente), exibidos como referências legíveis. O sistema SHALL oferecer ainda as colunas opcionais de rastreio do tracker: Data de Início Real, Data de Fim Real, Responsável Externo e Chave Externa. Essas colunas SHALL nascer ocultas, poder ser exibidas e ocultadas pelo seletor de colunas e, quando o usuário tiver permissão, aceitar edição inline dos campos correspondentes. A Chave Externa SHALL ser exibida como referência somente leitura derivada de `externalSource`/`externalRef`.

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

#### Scenario: Coluna de dependências exibe itens dependidos
- **WHEN** um item com dependências cadastradas é exibido na Tree View
- **THEN** a coluna Dependências lista cada item dependido, priorizando o `sequenceCode` e usando o título quando o código não existir

#### Scenario: Item sem dependências
- **WHEN** um item sem dependências é exibido na Tree View
- **THEN** a célula da coluna Dependências fica vazia, sem indicar dependência inexistente

#### Scenario: Respeitar filtros na coluna de dependências
- **WHEN** a Tree View é filtrada por módulo, sprint, responsável ou tag
- **THEN** a coluna Dependências continua refletindo as dependências cadastradas dos itens exibidos

#### Scenario: Colunas de tracker ocultas por padrão
- **WHEN** o usuário abre a Tree View pela primeira vez
- **THEN** datas realizadas, responsável externo e chave externa não ocupam a grade até serem escolhidas no seletor de colunas

#### Scenario: Exibir e editar datas realizadas
- **WHEN** o usuário ativa a coluna Data de Início Real ou Data de Fim Real
- **THEN** a coluna exibe o valor do item e permite edição inline quando o usuário tem permissão

#### Scenario: Responsável externo na grade
- **WHEN** o card tem `assigneeLabel` e não tem usuário responsável
- **THEN** a coluna Responsável Externo exibe o rótulo informado

#### Scenario: Chave externa somente leitura
- **WHEN** o card tem `externalSource` e `externalRef` e a coluna Chave Externa está visível
- **THEN** a célula exibe a referência sem oferecer edição direta

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
O sistema SHALL aplicar à Tree View os mesmos filtros de população do Kanban (módulo, sprint, responsável, squad, tags, status, prioridade, versão, autor, centro de custo, tipo e última alteração) via `GET /projects/:id/items/tree`, usando a mesma fonte única de motivos de visibilidade do board. O progresso SHALL ser recalculado sobre o resultado filtrado.

#### Scenario: Filtro por responsável na Tree View
- **WHEN** usuário seleciona um membro no filtro
- **THEN** Tree View exibe apenas itens atribuídos a esse membro; ramos sem nenhum item correspondente são omitidos e os que têm correspondência permanecem para navegação

#### Scenario: Filtro por status na Tree View
- **WHEN** usuário seleciona um status no filtro
- **THEN** Tree View exibe apenas as folhas com esse status, sem listar cards concluídos ou não iniciados fora do recorte

#### Scenario: Filtros combinados na Tree View
- **WHEN** o usuário combina mais de um filtro de população (por exemplo, responsável e status)
- **THEN** as folhas exibidas atendem a todos os filtros simultaneamente

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

---

### Requirement: Tree View pula níveis ocultados

A Tree View SHALL respeitar as opções de ocultar módulos e épicos: com módulos
ocultos, a raiz exibe os épicos; com épicos ocultos, as histórias aparecem sob o
módulo ou na raiz; com ambos ocultos, a raiz exibe as histórias. O conteúdo e a
navegação das linhas SHALL ser preservados.

#### Scenario: Árvore sem módulos

- **WHEN** o projeto tem módulos ocultos
- **THEN** a árvore não exibe nós de módulo e lista os épicos no nível raiz

#### Scenario: Árvore sem épicos

- **WHEN** o projeto tem épicos ocultos
- **THEN** a árvore não exibe nós de épico e lista as histórias sob o módulo (ou na raiz, se módulos também ocultos)

#### Scenario: Árvore sem módulos nem épicos

- **WHEN** as duas opções estão ligadas
- **THEN** a árvore lista as histórias na raiz, com suas tasks e subtasks

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

### Requirement: Filtros por coluna de cabeçalho na Tree View
A Tree View SHALL oferecer filtro direto no cabeçalho das colunas Status, Responsável, Prioridade, Sprint, Versão e Centro de Custo. O filtro aplicado pela coluna SHALL usar a mesma dimensão do painel de filtros do board e SHALL ser combinado com os demais filtros por AND. A coluna com filtro ativo SHALL exibir indicador visual. O menu de filtro SHALL fechar ao clicar fora ou pressionar Escape.

#### Scenario: Filtrar por status pelo cabeçalho
- **WHEN** o usuário escolhe um status no filtro da coluna Status
- **THEN** a grade passa a exibir apenas as folhas com esse status e o painel de filtros reflete a mesma seleção

#### Scenario: Filtro de coluna combinado com outro filtro
- **WHEN** o usuário aplica responsável pelo cabeçalho e mantém um módulo ativo no painel
- **THEN** a grade exibe apenas itens que atendem aos dois critérios

#### Scenario: Indicador de filtro ativo
- **WHEN** uma coluna tem filtro aplicado
- **THEN** o cabeçalho da coluna exibe indicador de filtro ativo

#### Scenario: Fechar menu sem aplicar
- **WHEN** o usuário clica fora do menu de filtro ou pressiona Escape
- **THEN** o menu fecha sem alterar os filtros

### Requirement: Criação inline abaixo da linha na Tree View
A Tree View SHALL oferecer uma ação de adicionar na linha que insere um formulário mínimo abaixo do nó para criar um filho compatível com a hierarquia. A criação SHALL respeitar as permissões do usuário e a mesma validação de tipo do fluxo de criação contextual. Confirmar SHALL persistir o item e atualizar a árvore; cancelar SHALL remover a linha sem persistir.

#### Scenario: Criar filho pela linha
- **WHEN** o usuário aciona o adicionar de uma linha e informa o título de um tipo compatível
- **THEN** o item é criado sob o nó atual e aparece na árvore após a atualização

#### Scenario: Cancelar criação inline
- **WHEN** o usuário pressiona Escape ou cancela a linha inline
- **THEN** nenhum item é criado e a árvore permanece inalterada

#### Scenario: Tipo incompatível não é oferecido
- **WHEN** o usuário abre o adicionar de um nó que não aceita determinado tipo como filho
- **THEN** esse tipo não é oferecido e a API rejeita qualquer tentativa inválida

#### Scenario: Viewer não cria pela linha
- **WHEN** usuário com papel VIEWER acessa a Tree View
- **THEN** a ação de adicionar não é exibida ou fica desabilitada
