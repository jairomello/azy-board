## ADDED Requirements

### Requirement: Campo Versão opcional na ItemModal (TASK/BUG)
O sistema SHALL exibir um campo "Versão" opcional na `ItemModal` de TASK e BUG, permitindo ao usuário associar o item a uma versão do projeto.

#### Scenario: Selecionar versão em TASK ou BUG
- **WHEN** usuário abre a `ItemModal` de uma TASK ou BUG e o projeto possui versões cadastradas
- **THEN** campo "Versão" é exibido com select das versões disponíveis (ordenadas por posição) e opção "Sem versão"

#### Scenario: Salvar versão associada
- **WHEN** usuário seleciona uma versão e salva o item
- **THEN** `versionId` é incluído no body do `PATCH /projects/:id/items/:id` e persiste

#### Scenario: Campo Versão oculto quando projeto não tem versões
- **WHEN** projeto não possui versões cadastradas
- **THEN** campo "Versão" não é renderizado na ItemModal
