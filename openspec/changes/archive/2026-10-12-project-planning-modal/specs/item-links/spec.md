# Spec Delta

## ADDED Requirements

### Requirement: Listagem agregada de links por projeto

O sistema SHALL disponibilizar uma leitura somente leitura que retorna todos os
links externos vinculados a qualquer item de um projeto, sem filtro por item.
A leitura SHALL ser escopada por tenant e projeto, exigir membership no projeto
e expor, para cada link, o item de origem. A operação SHALL estar disponível
a usuários com acesso de leitura e independentemente da configuração de anexos.

#### Scenario: Listar todos os links do projeto

- **WHEN** um usuário com acesso de leitura requisita os links agregados de um projeto
- **THEN** o sistema retorna todos os links dos itens do projeto no tenant, cada um com seu item de origem

#### Scenario: Projeto sem links

- **WHEN** o projeto não possui links em nenhum item
- **THEN** o sistema retorna uma lista vazia

#### Scenario: Isolamento entre projetos e tenants

- **WHEN** um usuário sem membership requisita os links agregados de um projeto não autorizado
- **THEN** o sistema rejeita a operação sem revelar links de outro tenant ou projeto

#### Scenario: Links disponíveis sem anexos

- **WHEN** a capacidade de anexos está desabilitada no tenant e um usuário autorizado requisita os links agregados
- **THEN** a leitura de links continua disponível e não depende da configuração de anexos
