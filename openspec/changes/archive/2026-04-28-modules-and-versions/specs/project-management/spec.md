## ADDED Requirements

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
