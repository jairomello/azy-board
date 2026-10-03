## ADDED Requirements

### Requirement: Catálogo de ícones open-source
O sistema SHALL disponibilizar um catálogo curado de ícones a partir de uma biblioteca open-source de licença permissiva (lucide-react, ISC), identificado por nomes estáveis em kebab-case e consumível por web, API e MCP. O catálogo SHALL ser a única fonte de nomes válidos de ícone para projetos e itens, e o sistema SHALL rejeitar nomes fora do catálogo.

#### Scenario: Catálogo disponível para seleção
- **WHEN** um cliente solicita os ícones disponíveis
- **THEN** o sistema expõe os nomes do catálogo a partir do contrato compartilhado, sem exigir o carregamento de todos os componentes de ícone

#### Scenario: Nome de ícone fora do catálogo é rejeitado
- **WHEN** cliente cria ou edita projeto ou item informando `icon` que não pertence ao catálogo
- **THEN** o sistema retorna erro 400 com mensagem de validação

#### Scenario: Licenciamento permissivo
- **WHEN** o catálogo é definido ou atualizado
- **THEN** ele usa apenas ícones de bibliotecas com licença ISC, MIT, Apache 2.0, BSD ou Public Domain, sem AGPL, GPL, LGPL, BSL ou licença comercial

### Requirement: Ícone e cor default
O sistema SHALL definir um ícone default de projeto e um ícone default de item, aplicados sempre que o registro não tiver ícone personalizado, e SHALL aplicar a cor padrão do tema quando não houver cor personalizada. Os defaults NÃO SHALL ser persistidos no banco.

#### Scenario: Projeto sem ícone usa o default
- **WHEN** um projeto possui `icon = null`
- **THEN** a interface exibe o ícone default de projeto

#### Scenario: Item sem ícone usa o default
- **WHEN** um item possui `icon = null`
- **THEN** a interface exibe o ícone default de item e a API retorna `icon = null`

#### Scenario: Sem cor, usa a cor padrão do tema
- **WHEN** projeto ou item possui `color = null`
- **THEN** a interface renderiza o ícone com a cor padrão do tema

### Requirement: Definir ícone e cor de projeto
O sistema SHALL permitir definir, alterar e limpar `icon` e `color` de um projeto tanto na criação (`POST /projects`) quanto na edição (`PATCH /projects/:id`). Os campos SHALL ser opcionais, aceitar `null` para limpar e ser validados contra o catálogo de ícones e a paleta de cores. As respostas de criação, edição, listagem e `GET /projects/:id` SHALL incluir os campos.

#### Scenario: Criar projeto com ícone e cor
- **WHEN** usuário cria projeto informando `icon` e `color` válidos
- **THEN** o sistema persiste os valores e os retorna na resposta

#### Scenario: Criar projeto sem aparência
- **WHEN** usuário cria projeto sem informar `icon` nem `color`
- **THEN** o sistema persiste ambos como `null` e a interface aplica os defaults

#### Scenario: Editar e limpar aparência do projeto
- **WHEN** administrador envia `PATCH /projects/:id` com `icon`/`color` válidos ou com `null`
- **THEN** o sistema atualiza os campos informados; `null` faz o projeto voltar ao default na interface

#### Scenario: Aparência de projeto inválida é rejeitada
- **WHEN** administrador envia `icon` fora do catálogo ou `color` fora da paleta
- **THEN** o sistema retorna erro 400 sem alterar o projeto

### Requirement: Definir ícone e cor de item
O sistema SHALL permitir definir, alterar e limpar `icon` e `color` de um item em qualquer tipo suportado, na criação (`POST /projects/:projectId/items`) e na edição (`PATCH /projects/:projectId/items/:itemId`). Os campos SHALL ser opcionais, aceitar `null` para limpar, ser validados contra o catálogo e a paleta, e SHALL ser retornados nas respostas REST e nas consultas de board.

#### Scenario: Criar item com ícone e cor
- **WHEN** usuário cria item informando `icon` e `color` válidos
- **THEN** o sistema persiste os valores e os retorna na resposta

#### Scenario: Editar e limpar aparência do item
- **WHEN** usuário edita o item com `icon`/`color` válidos ou com `null`
- **THEN** o sistema atualiza os campos informados; `null` faz o item voltar ao default na interface

#### Scenario: Aparência de item inválida é rejeitada
- **WHEN** usuário envia `icon` fora do catálogo ou `color` fora da paleta
- **THEN** o sistema retorna erro 400 sem alterar o item

#### Scenario: Campos de aparência presentes no board
- **WHEN** um cliente consulta os itens do board
- **THEN** cada item inclui `icon` e `color`, com `null` quando não definidos

### Requirement: Exibição consistente do ícone
O sistema SHALL exibir o ícone do projeto na sidebar/cabeçalho, no breadcrumb e na lista de projetos, e o ícone do item no card do Kanban e no cabeçalho do modal do item, respeitando a cor definida quando houver.

#### Scenario: Ícone do projeto no shell e na lista
- **WHEN** a interface renderiza a sidebar/cabeçalho ou a lista de projetos
- **THEN** o ícone do projeto (ou o default) é exibido; na lista ele substitui o avatar de letra quando o projeto tem ícone

#### Scenario: Ícone do item no card
- **WHEN** o card de um item é renderizado no Kanban
- **THEN** o ícone do item (ou o default) aparece junto ao título do card

#### Scenario: Ícone do item no modal
- **WHEN** o modal de um item é aberto
- **THEN** o cabeçalho do modal exibe o ícone do item (ou o default) com a cor definida

### Requirement: Exposição via API e MCP
O sistema SHALL expor `icon` e `color` de projeto e item nas respostas REST, na projeção do board e nas tools MCP de criação e edição, permitindo que agentes leiam e definam esses campos.

#### Scenario: API REST retorna os campos
- **WHEN** cliente autenticado cria, edita ou lista projetos e itens
- **THEN** as respostas incluem `icon` e `color` (ou `null`)

#### Scenario: MCP cria e atualiza aparência
- **WHEN** agente usa as tools `create_project`, `update_project`, `create_task`, `update_item` ou `update_items` informando `icon`/`color`
- **THEN** o sistema aplica os valores validados e os devolve no retorno da tool

#### Scenario: MCP lê a aparência
- **WHEN** agente usa as tools de leitura do board com projeção de campos
- **THEN** `icon` e `color` estão disponíveis entre os campos projetáveis/retornados

### Requirement: Internacionalização da aparência
O sistema SHALL fornecer traduções em PT-BR, EN e ES para todos os labels, placeholders e ações do seletor de ícone e cor.

#### Scenario: Troca de idioma do seletor
- **WHEN** o usuário alterna o idioma da interface
- **THEN** os labels, placeholders e ações do seletor de ícone e cor são exibidos no idioma selecionado
