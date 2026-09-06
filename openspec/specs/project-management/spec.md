## Purpose

Definir os requisitos da capacidade project management.

## Requirements

### Requirement: Criar projeto
O sistema SHALL permitir que um usuário autenticado crie um novo projeto informando nome, descrição opcional, modo de board opcional (`HIERARCHICAL` ou `SIMPLE`) e os sinalizadores opcionais de visibilidade `isRestricted` e `isHidden`. Quando o modo não for informado, SHALL usar `HIERARCHICAL`. Quando os sinalizadores de visibilidade não forem informados, SHALL usar `false` para ambos, produzindo um projeto visível para todos os membros do tenant conforme as regras de escopo por grupo.

#### Scenario: Criação bem-sucedida com colunas padrão
- **WHEN** usuário envia nome do projeto
- **THEN** sistema cria o projeto, associa o criador como administrador, cria o módulo padrão "Geral" e provisiona automaticamente 6 colunas em ordem de fluxo: Backlog (NOT_STARTED), A Fazer (NOT_STARTED), Fazendo (IN_PROGRESS), A Testar (IN_PROGRESS), Testando (IN_PROGRESS), Concluídas (DONE)

#### Scenario: Criação de projeto simples
- **WHEN** usuário envia nome do projeto com `boardMode = SIMPLE`
- **THEN** sistema cria o projeto com uma STORY fixa, sem criar módulo ou EPIC para a apresentação do board, associa o criador como administrador e provisiona as 6 colunas padrão

#### Scenario: Board simples pronto para uso imediato
- **WHEN** usuário acessa um projeto simples recém-criado
- **THEN** a STORY fixa e as 6 colunas padrão estão presentes e o board aceita criação e movimentação de TASKs/BUGs

#### Scenario: Board pronto para uso imediato
- **WHEN** usuário acessa o board de um projeto recém-criado
- **THEN** as 6 colunas padrão já estão presentes e o board aceita criação de cards sem configuração adicional

#### Scenario: Nome duplicado no mesmo workspace
- **WHEN** usuário tenta criar projeto com nome já existente no workspace
- **THEN** sistema retorna erro 409 com mensagem indicando duplicidade

#### Scenario: Projeto criado sem sinalizadores de visibilidade
- **WHEN** usuário cria projeto sem informar `isRestricted` nem `isHidden`
- **THEN** sistema persiste ambos como `false` e os devolve na resposta

#### Scenario: Projeto criado restrito
- **WHEN** usuário cria projeto informando `isRestricted = true`
- **THEN** sistema persiste o projeto como restrito e o criador, por ser membro, continua visualizando-o na listagem

---

### Requirement: Listar projetos do usuário
O sistema SHALL retornar, na listagem de projetos, apenas os projetos que o usuário autenticado tem permissão de ver: para Membros de Equipe e Gerentes, somente os projetos com vínculo (membership ativa ou indicação como Gerente Geral); para Admin e Root, os projetos do tenant exceto os restritos sem vínculo. Em todos os casos, o sistema SHALL excluir projetos ocultos, a menos que a requisição informe `includeHidden=true`.

#### Scenario: Listagem filtrada por membership
- **WHEN** usuário solicita lista de projetos
- **THEN** sistema retorna somente projetos onde o usuário possui membership ativa, independente de IDs passados na URL

#### Scenario: Listagem exclui projetos ocultos por padrão
- **WHEN** usuário solicita lista de projetos sem informar `includeHidden`
- **THEN** sistema não retorna os projetos marcados como ocultos

#### Scenario: Listagem inclui projetos ocultos quando solicitado
- **WHEN** usuário solicita lista de projetos com `includeHidden=true`
- **THEN** sistema retorna também os projetos ocultos que o usuário tem permissão de ver

#### Scenario: Listagem exclui projetos restritos sem vínculo
- **WHEN** usuário solicita lista de projetos e existe projeto restrito no tenant sem membership nem gerência do usuário
- **THEN** sistema não retorna esse projeto, mesmo que o usuário seja Admin ou Root

---

### Requirement: Gerenciar squads dentro de um projeto
O sistema SHALL permitir criar múltiplos squads dentro de um projeto e associar membros a cada squad.

#### Scenario: Criação de squad
- **WHEN** administrador do projeto cria um squad com nome
- **THEN** sistema registra o squad vinculado ao projeto

#### Scenario: Adição de membro ao squad
- **WHEN** administrador adiciona um usuário ao squad informando e-mail ou matrícula
- **THEN** sistema cria membership do usuário no squad com o perfil especificado

---

### Requirement: Perfis e permissões por projeto
O sistema SHALL suportar perfis: `ADMIN`, `MEMBER` e `VIEWER`. Cada perfil define o que o usuário pode fazer dentro do projeto.

#### Scenario: Viewer não pode criar cards
- **WHEN** usuário com perfil VIEWER tenta criar um card via API
- **THEN** sistema retorna erro 403

#### Scenario: Admin pode alterar perfil de outros membros
- **WHEN** usuário ADMIN altera perfil de um membro
- **THEN** sistema atualiza o perfil e o novo nível de permissão entra em vigor imediatamente

---

### Requirement: Proteção contra acesso não autorizado a projetos
O sistema SHALL verificar server-side se o usuário autenticado tem membership no projeto antes de retornar qualquer dado. Para projetos restritos, Admin e Root também SHALL possuir membership ativa ou estar indicado como Gerente Geral; o grupo global não SHALL conceder bypass dessa regra. A mesma proteção SHALL ser aplicada a acessos por URL, API Key, MCP e agentes.

#### Scenario: Acesso por ID manipulado na URL
- **WHEN** usuário tenta acessar projeto cujo ID foi inserido manualmente na URL sem ter membership
- **THEN** sistema retorna erro 404 (não revela existência do recurso)

#### Scenario: Admin sem associação tenta acessar projeto restrito
- **WHEN** Admin ou Root tenta acessar por URL um projeto restrito no qual não possui membership nem é Gerente Geral
- **THEN** sistema retorna erro 404 e não revela os dados do projeto

#### Scenario: Agente sem associação tenta acessar projeto restrito
- **WHEN** agente, MCP ou API Key de um usuário sem associação tenta acessar um projeto restrito
- **THEN** sistema retorna erro 404 e não revela os dados do projeto

---

### Requirement: Seção "Módulos" na tela de Settings do projeto
O sistema SHALL exibir uma seção dedicada "Módulos" na tela de configurações do projeto (`SettingsPage`), após as seções existentes (Colunas, Membros, Squads).

#### Scenario: Acesso à seção Módulos
- **WHEN** admin navega para Settings do projeto
- **THEN** seção "Módulos" é exibida com a lista de módulos existentes e formulário de criação

#### Scenario: VIEWER vê módulos mas não pode editar
- **WHEN** usuário com papel VIEWER acessa Settings
- **THEN** seção "Módulos" exibe a lista somente para leitura, sem botões de criar/editar/excluir

---

### Requirement: Seção "Versões" na tela de Settings do projeto
O sistema SHALL exibir uma seção dedicada "Versões" na tela de configurações do projeto (`SettingsPage`), após a seção "Módulos".

#### Scenario: Acesso à seção Versões
- **WHEN** admin navega para Settings do projeto
- **THEN** seção "Versões" é exibida com a lista de versões (nome, situação badge, data) e botão "Nova versão"

#### Scenario: Lista vazia de versões
- **WHEN** projeto não possui versões cadastradas
- **THEN** seção exibe mensagem "Nenhuma versão cadastrada" com botão "Criar primeira versão"

---

### Requirement: Gerente Geral do Projeto
O sistema SHALL permitir indicar um usuário como Gerente Geral do Projeto no momento da criação e nas configurações do projeto. O campo é opcional e informativo (sem RBAC adicional nesta versão).

#### Scenario: Indicar gerente na criação do projeto
- **WHEN** usuário cria novo projeto e informa `manager_user_id` no payload
- **THEN** sistema persiste o campo e exibe o nome do gerente nas configurações do projeto

#### Scenario: Campo gerente opcional na criação
- **WHEN** usuário cria projeto sem informar `manager_user_id`
- **THEN** projeto é criado normalmente com `manager_user_id = null`; campo fica em branco nas configurações

#### Scenario: Alterar gerente nas configurações
- **WHEN** administrador acessa configurações do projeto e seleciona outro usuário membro como gerente
- **THEN** sistema atualiza `manager_user_id` e exibe o novo gerente imediatamente

#### Scenario: Gerente deve ser membro do projeto
- **WHEN** administrador tenta definir como gerente um usuário que não é membro do projeto
- **THEN** sistema retorna erro 422 "O gerente deve ser membro do projeto"

#### Scenario: Remover gerente
- **WHEN** administrador limpa o campo de gerente nas configurações
- **THEN** sistema persiste `manager_user_id = null` e o campo fica em branco

---

### Requirement: Seção "Centros de Custo" nas Settings do projeto
O sistema SHALL exibir uma seção "Centros de Custo" na página de configurações do projeto, após a seção de Membros & Squads.

#### Scenario: Acesso à seção Centros de Custo
- **WHEN** qualquer membro navega para as configurações do projeto
- **THEN** seção "Centros de Custo" é exibida (em modo somente leitura para VIEWER/MEMBER, com CRUD completo para ADMIN)

---

### Requirement: Renomear projeto pelo card
O sistema SHALL permitir que um usuário com papel `ADMIN` altere o nome de um projeto existente a partir do card na tela de projetos. O nome SHALL ser obrigatório, normalizado com remoção de espaços laterais e único dentro do tenant.

#### Scenario: Admin abre a edição pelo card
- **WHEN** usuário ADMIN visualiza um card de projeto
- **THEN** o card exibe uma ação de editar e, ao acioná-la, abre um formulário com o nome atual preenchido sem navegar para o board

#### Scenario: Admin renomeia projeto com sucesso
- **WHEN** usuário ADMIN informa um nome válido e confirma a edição
- **THEN** sistema envia `PATCH /projects/:projectId` com o nome, persiste o valor normalizado, fecha o formulário e exibe o novo nome no card

#### Scenario: Nome vazio é rejeitado
- **WHEN** usuário ADMIN remove todo o conteúdo do nome ou informa apenas espaços
- **THEN** sistema impede o salvamento e exibe uma mensagem de validação sem alterar o nome persistido

#### Scenario: Nome duplicado no tenant é rejeitado
- **WHEN** usuário ADMIN tenta renomear um projeto para o nome de outro projeto do mesmo tenant
- **THEN** sistema retorna erro 409, exibe feedback de conflito e mantém o nome anterior no card

#### Scenario: Usuário não administrador não vê edição
- **WHEN** usuário MEMBER ou VIEWER visualiza a lista de projetos
- **THEN** o card não exibe a ação de editar

#### Scenario: Tentativa não autorizada via API
- **WHEN** usuário MEMBER ou VIEWER envia diretamente `PATCH /projects/:projectId` para alterar o nome
- **THEN** sistema retorna erro 403 e não altera o projeto

#### Scenario: Projeto permanece navegável
- **WHEN** usuário clica em qualquer área do card que não seja a ação de editar
- **THEN** sistema navega para `/projects/:projectId/board` sem abrir o formulário de edição

### Requirement: Excluir projeto em cascata
O sistema SHALL permitir que um usuário com papel `ADMIN` exclua um projeto a partir do card na tela de projetos. A exclusão SHALL remover o projeto e todos os registros filhos pertencentes a ele em uma única transação atômica, sem criar registros órfãos.

#### Scenario: Admin inicia exclusão pelo card
- **WHEN** usuário ADMIN visualiza um card de projeto na tela de projetos
- **THEN** o card exibe uma ação de exclusão com ícone de lixeira e essa ação não navega para o board

#### Scenario: Confirmação informa a abrangência
- **WHEN** usuário aciona a ação de exclusão
- **THEN** sistema exibe um diálogo informando o nome do projeto e que o projeto e todos os seus registros filhos serão excluídos permanentemente, com opções explícitas de cancelar e confirmar

#### Scenario: Exclusão confirmada com sucesso
- **WHEN** usuário ADMIN confirma a exclusão e o backend conclui a transação
- **THEN** sistema exclui o projeto e seus registros dependentes, retorna sucesso e remove o card da lista de projetos

#### Scenario: Exclusão cancelada
- **WHEN** usuário abre a confirmação mas escolhe cancelar ou fecha o diálogo
- **THEN** sistema não envia requisição, não altera nenhum registro e mantém o card visível

#### Scenario: Usuário sem ADMIN não vê a ação
- **WHEN** usuário MEMBER ou VIEWER visualiza a lista de projetos
- **THEN** o card não renderiza a ação de exclusão

#### Scenario: Tentativa não autorizada via API
- **WHEN** usuário MEMBER ou VIEWER envia diretamente uma requisição de exclusão para um projeto
- **THEN** sistema retorna HTTP 403 e não exclui nenhum registro

#### Scenario: Projeto de outro tenant não é revelado
- **WHEN** usuário autenticado envia uma requisição de exclusão para um projeto que não pertence ao seu tenant ou no qual não possui membership
- **THEN** sistema retorna HTTP 404 e não modifica nenhum dado

#### Scenario: Falha aborta a exclusão
- **WHEN** ocorre erro ao excluir qualquer registro filho durante a operação
- **THEN** sistema faz rollback da transação, mantém o projeto e seus registros intactos e retorna erro ao cliente
