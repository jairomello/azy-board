## ADDED Requirements

### Requirement: Campo Versão opcional na EpicModal e StoryModal
O sistema SHALL exibir um campo "Versão" opcional na `EpicModal` e na `StoryModal`, permitindo associar épicos e histórias a versões do projeto.

#### Scenario: Selecionar versão em Épico
- **WHEN** usuário abre a `EpicModal` e o projeto possui versões cadastradas
- **THEN** campo "Versão" é exibido com select das versões disponíveis e opção "Sem versão"

#### Scenario: Selecionar versão em História
- **WHEN** usuário abre a `StoryModal` e o projeto possui versões cadastradas
- **THEN** campo "Versão" é exibido com select das versões disponíveis e opção "Sem versão"

#### Scenario: Salvar versão em Épico ou História
- **WHEN** usuário seleciona uma versão e salva
- **THEN** `versionId` é incluído no body do PATCH do respectivo item e persiste

#### Scenario: Campo Versão oculto quando projeto não tem versões
- **WHEN** projeto não possui versões cadastradas
- **THEN** campo "Versão" não é renderizado nas modais de Épico e História
