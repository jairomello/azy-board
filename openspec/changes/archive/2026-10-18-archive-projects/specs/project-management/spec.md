# Spec Delta

Board ref: 5ba05757-4c53-4012-bc84-2d32f936177a

## MODIFIED Requirements

### Requirement: Listar projetos do usuário
O sistema SHALL retornar, na listagem de projetos, apenas os projetos que o usuário autenticado tem permissão de ver: para Membros de Equipe e Gerentes, somente os projetos com vínculo (membership ativa ou indicação como Gerente Geral); para Admin e Root, os projetos do tenant exceto os restritos sem vínculo. Em todos os casos, o sistema SHALL retornar apenas projetos ativos por padrão e excluir projetos ocultos, a menos que a requisição informe `includeHidden=true`. Com `includeArchived=true`, o sistema SHALL retornar apenas os projetos arquivados, nunca os ativos. O filtro de ocultação SHALL ser aplicado de forma independente dentro do recorte escolhido (ativos ou arquivados).

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

#### Scenario: Listagem normal exclui projetos arquivados
- **WHEN** usuário solicita a listagem sem `includeArchived=true`
- **THEN** projetos arquivados não são retornados, mesmo que sejam ocultos e `includeHidden=true` esteja ativo

#### Scenario: Visualizar projetos arquivados
- **WHEN** usuário solicita a listagem com `includeArchived=true`
- **THEN** são retornados somente os projetos arquivados que o usuário tem permissão para ver, sem incluir projetos ativos

#### Scenario: Ocultação aplicada dentro do recorte de arquivados
- **WHEN** usuário solicita `includeArchived=true` sem `includeHidden`
- **THEN** projetos arquivados e ocultos não são retornados; com `includeHidden=true` e `includeArchived=true`, os arquivados ocultos são retornados e nenhum projeto ativo aparece

## ADDED Requirements

### Requirement: Arquivar e restaurar projeto
O sistema SHALL permitir que usuários `ADMIN` arquivem e restaurem projetos sem excluir o projeto ou seus dados. O estado arquivado SHALL ser persistido separadamente de `isHidden` e `isRestricted`.

#### Scenario: Arquivar projeto pela listagem
- **WHEN** usuário `ADMIN` aciona Arquivar no card de um projeto ativo e confirma a ação
- **THEN** o projeto passa a estar arquivado, permanece armazenado e deixa a listagem padrão

#### Scenario: Cancelar arquivamento
- **WHEN** usuário cancela a confirmação de arquivamento
- **THEN** o sistema não altera o projeto e nenhuma operação de arquivamento é enviada

#### Scenario: Restaurar projeto arquivado
- **WHEN** usuário `ADMIN` aciona Restaurar no card de um projeto arquivado
- **THEN** o projeto deixa de estar arquivado e volta à listagem normal, respeitando separadamente as regras de visibilidade e acesso

#### Scenario: Impedir arquivamento sem permissão
- **WHEN** usuário sem papel `ADMIN` tenta arquivar ou restaurar um projeto, inclusive por chamada direta à API
- **THEN** a operação é rejeitada com HTTP 403 e o estado do projeto não muda

#### Scenario: Isolamento entre tenants
- **WHEN** usuário tenta arquivar ou restaurar projeto de outro tenant ou sem autorização de acesso
- **THEN** a API não revela a existência do projeto e não altera seus dados

### Requirement: Buscar projetos na listagem
A listagem de projetos SHALL oferecer um campo de busca que filtre os cards pelo nome, sem alterar os dados persistidos ou as regras de autorização e visibilidade.

#### Scenario: Filtrar projetos pelo nome
- **WHEN** usuário digita texto no campo de busca
- **THEN** somente cards de projetos carregados cujo nome contenha o texto informado, sem distinção entre maiúsculas e minúsculas, são exibidos

#### Scenario: Limpar busca
- **WHEN** usuário limpa o campo de busca
- **THEN** todos os projetos carregados que correspondem aos demais filtros voltam a ser exibidos

#### Scenario: Nenhum projeto corresponde à busca
- **WHEN** nenhum projeto carregado corresponde ao texto informado
- **THEN** a listagem exibe o estado vazio de busca sem criar ou alterar projetos
