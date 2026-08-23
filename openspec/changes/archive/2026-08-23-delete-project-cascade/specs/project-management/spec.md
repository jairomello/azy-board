## ADDED Requirements

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
