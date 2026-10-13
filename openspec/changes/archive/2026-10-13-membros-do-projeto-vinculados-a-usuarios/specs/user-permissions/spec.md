# Spec Delta

## ADDED Requirements

### Requirement: Listagem de usuários do tenant no escopo do projeto
O sistema SHALL permitir que quem administra um projeto liste os usuários do tenant ativo como candidatos a membro desse projeto, aplicando a mesma regra de administração de projeto usada para adicionar, editar e remover membros. Essa listagem SHALL ser restrita ao tenant ativo, SHALL NOT conceder acesso ao módulo Administração e SHALL NOT ampliar o escopo global de projetos do usuário.

#### Scenario: Gerente associado lista usuários do projeto
- **WHEN** Gerente associado ao projeto solicita os candidatos a membro
- **THEN** o sistema retorna os usuários do tenant ativo e permite a operação

#### Scenario: Gerente sem associação não lista usuários
- **WHEN** Gerente sem membership e sem gerência do projeto solicita os candidatos a membro
- **THEN** o sistema nega a operação sem revelar usuários nem dados do projeto

#### Scenario: Membro de Equipe não lista usuários
- **WHEN** Membro de Equipe do projeto solicita os candidatos a membro
- **THEN** o sistema responde 403 e não retorna dados de usuários

#### Scenario: Listagem não concede o módulo Administração
- **WHEN** um Gerente com permissão de administrar o projeto acessa a aplicação
- **THEN** o menu `Admin` continua oculto e a listagem de usuários do tenant fora do projeto continua negada

#### Scenario: Escopo global permanece inalterado
- **WHEN** um Gerente lista os candidatos a membro de um projeto
- **THEN** a lista de projetos que ele visualiza não muda

#### Scenario: Somente o tenant ativo
- **WHEN** qualquer usuário solicita candidatos a membro
- **THEN** o sistema não retorna usuários de outro tenant
