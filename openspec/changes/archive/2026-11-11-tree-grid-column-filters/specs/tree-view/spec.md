# Spec Delta

## ADDED Requirements

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
