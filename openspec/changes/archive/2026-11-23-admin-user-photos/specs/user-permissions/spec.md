# Spec Delta

## ADDED Requirements

### Requirement: Miniatura de foto na listagem de usuários
A área `Admin` → `/admin/users` SHALL exibir, como primeira coluna da grade de usuários, uma miniatura circular da foto de cada usuário posicionada à esquerda do nome. Quando o usuário não tiver foto, a miniatura SHALL exibir o avatar por iniciais. A miniatura SHALL ser um controle acionável por mouse e teclado, com rótulo acessível que identifique o usuário e a ação de foto, e a listagem SHALL continuar paginada e filtrável como hoje.

#### Scenario: Miniatura da foto na linha do usuário
- **WHEN** um Admin abre `/admin/users` com usuários que possuem e que não possuem foto
- **THEN** cada linha exibe uma miniatura circular à esquerda do nome — a foto quando existir e o avatar por iniciais quando não existir

#### Scenario: Miniatura acessível
- **WHEN** o Admin percorre a grade somente com teclado
- **THEN** a miniatura de cada usuário recebe foco, expõe rótulo acessível com o nome do usuário e pode ser acionada por Enter ou Espaço

#### Scenario: Busca, ordenação e paginação preservadas
- **WHEN** o Admin aplica busca por nome ou e-mail, filtro de grupo ou troca de página
- **THEN** a coluna de miniatura acompanha as demais colunas, mantendo a paginação no servidor e a correspondência entre miniatura, nome e e-mail da linha

### Requirement: Gestão da foto de perfil de outro usuário pelo Admin
Admin e Root SHALL poder incluir ou substituir a foto de perfil de qualquer usuário do tenant ativo, inclusive de usuários `ROOT`, sem exigir ação do usuário alvo. O fluxo SHALL reutilizar o editor de recorte e o servidor SHALL aplicar a mesma validação e normalização do upload do próprio perfil. A nova foto SHALL aparecer na lista e no perfil do usuário alvo sem exigir novo login.

#### Scenario: Incluir foto de usuário sem foto
- **WHEN** o Admin aciona a miniatura de um usuário sem foto, escolhe uma imagem, confirma o recorte e o envio
- **THEN** o sistema grava a foto normalizada para o usuário alvo e a miniatura da linha passa a exibir a nova foto

#### Scenario: Substituir foto existente
- **WHEN** o Admin aciona a miniatura de um usuário que já possui foto e confirma um novo recorte
- **THEN** o sistema substitui a foto anterior, invalida o cache da imagem antiga e exibe a nova foto na lista

#### Scenario: Foto refletida no perfil do usuário alvo
- **WHEN** a foto de um usuário é alterada pelo Admin
- **THEN** as próximas exibições do usuário alvo em cards, comentários e demais telas mostram a nova foto, sem que o usuário alvo precise sair e entrar novamente

#### Scenario: Arquivo inválido ou acima do limite
- **WHEN** o Admin envia um arquivo que não é imagem de formato permitido ou que excede o tamanho máximo aceito
- **THEN** o sistema rejeita o envio com mensagem de erro, preserva a foto anterior do usuário alvo e mantém a lista utilizável

#### Scenario: Falha de rede durante o envio
- **WHEN** o envio ou a normalização falha
- **THEN** o sistema informa o erro, mantém a foto anterior e permite nova tentativa sem recarregar a página

#### Scenario: Estado de envio
- **WHEN** o envio da foto está em andamento
- **THEN** a linha ou o diálogo em uso indica o processamento e impede envios duplicados do mesmo usuário

#### Scenario: Textos internacionalizados
- **WHEN** a interface é exibida em pt-BR, en ou es
- **THEN** todos os textos novos da gestão de foto estão traduzidos no namespace `common`

### Requirement: Autorização da gestão de fotos pelo Admin
As operações administrativas de foto de perfil SHALL ser autorizadas exclusivamente no servidor para usuários com grupo global `ADMIN` ou `ROOT`, SHALL ser restritas ao tenant ativo e SHALL exigir que o usuário alvo pertença a esse tenant. Um usuário sem nível Admin SHALL NÃO poder alterar a foto de outro usuário, e o sistema SHALL falhar sem revelar dados de usuários de outros tenants. A operação SHALL ser registrada em log de auditoria com o identificador do executor e do usuário alvo.

#### Scenario: Admin altera foto de usuário do tenant
- **WHEN** um Admin envia a foto para qualquer usuário do tenant ativo, inclusive um Root
- **THEN** o sistema autoriza a operação e persiste a foto apenas para aquele usuário no tenant ativo

#### Scenario: Root altera foto de Admin
- **WHEN** um Root envia a foto de um usuário Admin do tenant ativo
- **THEN** o sistema autoriza a operação e atualiza a foto do usuário alvo

#### Scenario: Membro tenta alterar foto de outro usuário
- **WHEN** um usuário com grupo `TEAM_MEMBER` ou `MANAGER` tenta incluir, substituir ou remover a foto de outro usuário
- **THEN** o sistema responde 403 e não altera nenhuma foto

#### Scenario: Alvo pertence a outro tenant
- **WHEN** um Admin envia o identificador de um usuário de outro tenant
- **THEN** o sistema responde 404 sem alterar a foto e sem revelar a existência desse usuário

#### Scenario: Auditoria da operação
- **WHEN** uma foto de usuário é alterada ou removida por Admin ou Root
- **THEN** o sistema registra em log o executor, o usuário alvo e a operação, sem registrar conteúdo da imagem

### Requirement: Remoção da foto de perfil de outro usuário pelo Admin
Admin e Root SHALL poder remover a foto de perfil de qualquer usuário do tenant ativo, mediante confirmação explícita no diálogo de gestão. Após a remoção, o sistema SHALL descartar a imagem armazenada, limpar o ponteiro de foto do usuário alvo e voltar a exibir o avatar por iniciais na lista e nas demais telas.

#### Scenario: Remover foto de um usuário
- **WHEN** o Admin confirma a remoção da foto de um usuário que possui foto
- **THEN** o sistema descarta a imagem armazenada, limpa a foto do usuário alvo e a miniatura passa a exibir o avatar por iniciais

#### Scenario: Remoção sem foto cadastrada
- **WHEN** o Admin abre o diálogo de um usuário que não possui foto
- **THEN** a ação de remoção não é oferecida e a interface permite apenas incluir uma foto

#### Scenario: Cancelar a remoção
- **WHEN** o Admin cancela a confirmação de remoção
- **THEN** a foto atual do usuário alvo permanece inalterada
