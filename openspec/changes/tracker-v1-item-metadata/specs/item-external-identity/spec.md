# Spec Delta

## ADDED Requirements

### Requirement: Chave externa estável e única por projeto

O sistema SHALL permitir que um item guarde uma chave externa composta por `external_source` e `external_ref`, ambos opcionais, mas obrigatórios em conjunto. A combinação `(tenant_id, project_id, external_source, external_ref)` SHALL ser única entre itens não nulos do mesmo projeto. A chave SHALL ser tratada como dado do projeto, nunca como segredo.

#### Scenario: Criar item com chave externa
- **WHEN** um membro cria um item informando `externalSource` e `externalRef`
- **THEN** o item é criado com a chave e a listagem consegue encontrá-lo pelo filtro correspondente

#### Scenario: Chave duplicada no mesmo projeto
- **WHEN** um membro tenta criar ou atualizar um item com uma chave já usada por outro item do mesmo projeto
- **THEN** o sistema recusa com conflito e não cria nem altera o item

#### Scenario: Par incompleto
- **WHEN** um membro informa apenas `externalSource` ou apenas `externalRef`
- **THEN** o sistema recusa com erro de validação e explica que os dois campos andam juntos

#### Scenario: Mesma chave em projetos diferentes
- **WHEN** dois projetos do mesmo tenant usam a mesma `externalSource` e `externalRef`
- **THEN** os dois itens existem independentemente, sem conflito entre projetos

#### Scenario: Isolamento entre tenants
- **WHEN** um usuário de outro tenant tenta ler ou atualizar um item pela chave externa
- **THEN** o sistema responde como recurso inexistente e não expõe dados do tenant original

### Requirement: Upsert idempotente por chave externa

O sistema SHALL oferecer uma operação de upsert por chave externa que cria o item quando a chave não existe e atualiza o item existente quando a chave já existe. A operação SHALL devolver `created` para distinguir os dois casos e SHALL aceitar apenas os campos informados no corpo. A operação SHALL respeitar a hierarquia, as permissões do projeto e o isolamento por tenant.

#### Scenario: Primeira carga cria
- **WHEN** o upsert recebe uma chave inexistente e os campos obrigatórios de criação
- **THEN** o item é criado e a resposta informa `created: true`

#### Scenario: Repetir a carga não duplica
- **WHEN** o mesmo upsert é executado novamente com a mesma chave
- **THEN** o item existente é atualizado e a resposta informa `created: false`, sem criar duplicata

#### Scenario: Atualização parcial
- **WHEN** o upsert recebe uma chave existente com apenas alguns campos alterados
- **THEN** somente esses campos são atualizados e os demais permanecem como estavam

#### Scenario: Chave trocada no corpo
- **WHEN** o upsert encontra um item pela chave e o corpo tenta informar outra chave
- **THEN** o sistema recusa com conflito e não altera a chave do item

#### Scenario: Falta de campos obrigatórios na criação
- **WHEN** o upsert recebe uma chave inexistente sem `title` ou sem o pai exigido pela hierarquia
- **THEN** o sistema recusa com erro de validação e não cria item incompleto

#### Scenario: Corrida entre dois upserts iguais
- **WHEN** duas requisições simultâneas tentam criar a mesma chave
- **THEN** apenas uma cria o item; a outra relê o item criado e o resultado final é um único registro
