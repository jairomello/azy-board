# Spec Delta

## Purpose

Definir os requisitos do cadastro de dependências entre itens do board, com tipos de dependência de cronograma e retardo em dias, incluindo validação de ciclos e apresentação na interface do item.

## ADDED Requirements

### Requirement: Cadastro de dependências entre itens

O sistema SHALL permitir que usuários autorizados associem múltiplas dependências a um item do board. Cada dependência SHALL referenciar o item de origem (`itemId`), o item do qual ele depende (`dependsOnItemId`), um tipo de dependência e um retardo. Origem e alvo SHALL pertencer ao mesmo projeto e tenant. O alvo SHALL ser qualquer item existente do projeto, independentemente do tipo (TASK, BUG, STORY ou EPIC).

#### Scenario: Criar dependência entre dois itens
- **WHEN** um membro autorizado envia o item dependido e o tipo para um item de origem acessível no mesmo projeto
- **THEN** o sistema persiste a dependência associada ao tenant, projeto e item de origem e retorna seus dados

#### Scenario: Item de origem igual ao dependido
- **WHEN** o usuário tenta criar uma dependência em que o item de origem e o item dependido são o mesmo
- **THEN** o sistema rejeita a operação com erro de validação acionável e não persiste o vínculo

#### Scenario: Alvo inexistente, de outro projeto ou de outro tenant
- **WHEN** o usuário informa um `dependsOnItemId` que não existe, pertence a outro projeto ou a outro tenant
- **THEN** o sistema rejeita a operação sem revelar dados de outros tenants e não persiste o vínculo

#### Scenario: Listar dependências do item
- **WHEN** um usuário com acesso de leitura consulta as dependências de um item
- **THEN** o sistema retorna somente as dependências associadas àquele item no tenant e projeto autorizados, com os dados necessários para exibir o item dependido

---

### Requirement: Tipos de dependência e retardo

O sistema SHALL aceitar exatamente quatro tipos de dependência: `FS` (Término-Início), `SS` (Início-Início), `SF` (Início-Término) e `FF` (Término-Término). Quando o tipo não for informado, o sistema SHALL assumir `FS`. O sistema SHALL aceitar um retardo (`lagDays`) inteiro, positivo ou negativo, com default `0`, representando a folga ou antecipação em dias.

#### Scenario: Tipo omitido assume Término-Início
- **WHEN** o usuário cria uma dependência sem informar o tipo
- **THEN** o sistema persiste a dependência com tipo `FS`

#### Scenario: Tipo inválido rejeitado
- **WHEN** o usuário informa um tipo diferente de `FS`, `SS`, `SF` ou `FF`
- **THEN** o sistema rejeita a operação com erro de validação e não persiste a dependência

#### Scenario: Retardo negativo aceito
- **WHEN** o usuário cria uma dependência com `lagDays` negativo
- **THEN** o sistema persiste o valor negativo sem alterar o sinal

#### Scenario: Retardo não inteiro rejeitado
- **WHEN** o usuário informa um `lagDays` que não é um número inteiro
- **THEN** o sistema rejeita a operação com erro de validação e não persiste a dependência

---

### Requirement: Bloqueio de dependências circulares

O sistema SHALL impedir a criação ou edição de uma dependência que introduza um ciclo no grafo de dependências do projeto, seja direto (`A → B` e `B → A`) ou indireto (`A → B → C → A`). O sistema SHALL rejeitar a operação com erro acionável e não persistir o vínculo.

#### Scenario: Ciclo direto rejeitado
- **WHEN** existe a dependência em que A depende de B e o usuário tenta criar a dependência em que B depende de A
- **THEN** o sistema rejeita a operação e mantém o grafo sem ciclo

#### Scenario: Ciclo indireto rejeitado
- **WHEN** existem A dependendo de B e B dependendo de C, e o usuário tenta criar a dependência em que C depende de A
- **THEN** o sistema rejeita a operação e mantém o grafo sem ciclo

#### Scenario: Grafo acíclico aceito
- **WHEN** a nova dependência não cria caminho de volta ao item de origem
- **THEN** o sistema aceita e persiste a dependência

---

### Requirement: Editar e remover dependências

O sistema SHALL permitir a usuários com permissão de escrita editar o tipo e o retardo de uma dependência existente e remover individualmente uma dependência. Campos omitidos em edição parcial SHALL permanecer inalterados. A edição SHALL respeitar o bloqueio de ciclos.

#### Scenario: Editar tipo e retardo
- **WHEN** um membro autorizado atualiza o tipo ou o retardo de uma dependência do item
- **THEN** o sistema persiste somente os campos enviados e retorna a dependência atualizada

#### Scenario: Remover dependência
- **WHEN** um membro autorizado remove uma dependência do item
- **THEN** o sistema exclui o vínculo e ele deixa de aparecer na listagem daquele item

#### Scenario: Usuário somente leitura tenta alterar
- **WHEN** um usuário com acesso somente de leitura tenta criar, editar ou remover uma dependência
- **THEN** o sistema rejeita a operação sem modificar os dados

---

### Requirement: Exclusão em cascata e integridade das dependências

Quando um item é excluído, o sistema SHALL remover, na mesma operação, todas as dependências em que ele figura como origem ou como alvo. Nenhuma dependência SHALL permanecer referenciando item inexistente, e a política de exclusão SHALL constar nas verificações de integridade do sistema.

#### Scenario: Excluir item de origem
- **WHEN** um item com dependências cadastradas é excluído
- **THEN** as dependências em que ele é origem são removidas junto com o item

#### Scenario: Excluir item alvo
- **WHEN** um item referenciado como dependido por outros itens é excluído
- **THEN** as dependências que apontavam para ele são removidas e nenhum vínculo órfão permanece

#### Scenario: Auditoria de integridade sem órfãos
- **WHEN** a auditoria de integridade é executada em uma base íntegra
- **THEN** ela reporta zero dependências sem pai e nenhuma referência entre tenants

---

### Requirement: Exposição de contagem e resumo de dependências nos itens

O sistema SHALL expor nos payloads de item usados pelo board e pela visão de árvore a lista resumida de dependências (`dependencies`) e a contagem (`dependencyCount`) dos itens dos quais aquele item depende diretamente. O resumo SHALL conter identificação suficiente para exibição (código, título e tipo) e a contagem SHALL refletir apenas dependências diretas do próprio item, sendo zero quando não houver dependências.

#### Scenario: Board expõe dependências e contagem
- **WHEN** o payload de um item do board é entregue e o item possui dependências cadastradas
- **THEN** o payload inclui `dependencies` com o resumo de cada item dependido e `dependencyCount` igual ao número de dependências diretas

#### Scenario: Árvore expõe dependências por linha
- **WHEN** o payload da visão de árvore entrega cada item
- **THEN** cada item inclui `dependencies` e `dependencyCount` suficientes para renderizar a coluna de dependências

#### Scenario: Item sem dependências
- **WHEN** um item não possui dependências cadastradas
- **THEN** `dependencies` é uma lista vazia e `dependencyCount` é zero

#### Scenario: Contagem reflete apenas dependências diretas
- **WHEN** um item depende de outros itens por múltiplos níveis
- **THEN** `dependencyCount` conta somente as dependências diretas daquele item, sem expandir a cadeia

---

### Requirement: Apresentação de dependências na interface do item

A interface SHALL apresentar uma aba "Dependências" no contexto do item, listando cada dependência com o item dependido, o tipo e o retardo. Usuários com permissão de escrita SHALL poder adicionar, editar e remover dependências pela interface; usuários somente leitura SHALL apenas consultar.

#### Scenario: Adicionar dependência pela interface
- **WHEN** um usuário autorizado seleciona um item do projeto, escolhe o tipo e informa o retardo na aba Dependências
- **THEN** a dependência é criada e aparece na lista do item

#### Scenario: Estado vazio
- **WHEN** o item não possui dependências
- **THEN** a interface apresenta estado vazio e, para usuário autorizado, uma ação para adicionar a primeira dependência

#### Scenario: Erro de ciclo exibido ao usuário
- **WHEN** a tentativa de adicionar uma dependência criaria um ciclo
- **THEN** a interface exibe a mensagem de erro acionável retornada pela API e não inclui a dependência na lista

#### Scenario: Consultar sem permissão de escrita
- **WHEN** um usuário com acesso somente de leitura abre a aba Dependências
- **THEN** ele visualiza as dependências existentes sem controles de criação, edição ou remoção
