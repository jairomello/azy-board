## ADDED Requirements

### Requirement: Interface de criação e edição de épicos no board
O sistema SHALL fornecer acesso à criação e edição de épicos diretamente do board, sem necessidade de navegar para outra página.

#### Scenario: Abrir painel de épicos
- **WHEN** usuário clica no botão "Épicos" ou "+" na área de swimlanes do board
- **THEN** modal ou painel lateral lista os épicos existentes do projeto com opção de criar novo

#### Scenario: Criar novo épico
- **WHEN** usuário clica em "Novo épico", preenche título e seleciona módulo, e confirma
- **THEN** épico é criado via API e uma nova swimlane aparece no board em tempo real

#### Scenario: Editar épico existente
- **WHEN** usuário clica no ícone de edição no header da swimlane do épico
- **THEN** modal de edição abre com os campos do épico (título, módulo, descrição) para alteração

---

### Requirement: Interface de criação e edição de histórias no board
O sistema SHALL fornecer acesso à criação e edição de histórias a partir da modal de cards ou do painel de épicos.

#### Scenario: Criar história a partir do épico
- **WHEN** usuário abre o painel do épico e clica em "Nova história"
- **THEN** formulário de criação de história é exibido vinculado ao épico selecionado

#### Scenario: Selecionar história ao criar card
- **WHEN** usuário cria ou edita um card e clica no campo "História"
- **THEN** dropdown exibe as histórias do projeto agrupadas por épico para seleção
