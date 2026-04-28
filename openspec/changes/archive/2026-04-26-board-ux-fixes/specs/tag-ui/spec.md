## ADDED Requirements

### Requirement: Criação de tags do projeto pela UI
O sistema SHALL permitir criar tags diretamente do board ou das configurações do projeto, sem precisar de acesso à API.

#### Scenario: Criar nova tag a partir do seletor de tags
- **WHEN** usuário está no seletor de tags do modal de edição e digita um nome não existente
- **THEN** opção "Criar tag '[nome]'" é exibida no dropdown; ao clicar, tag é criada via API e já adicionada ao card

#### Scenario: Criar tag com cor customizada
- **WHEN** usuário cria uma nova tag
- **THEN** pode selecionar uma cor de uma paleta predefinida; a tag aparece com a cor escolhida como chip no card

---

### Requirement: Atribuição de tags aos cards pela UI
O sistema SHALL exibir um seletor de tags na modal de edição do card que permite adicionar e remover tags.

#### Scenario: Adicionar tag ao card
- **WHEN** usuário seleciona uma tag no seletor dentro da modal
- **THEN** chip colorido da tag aparece no card e a associação é salva via API

#### Scenario: Remover tag do card
- **WHEN** usuário clica no "×" de um chip de tag dentro da modal
- **THEN** tag é removida do card e a desassociação é salva via API

#### Scenario: Tags visíveis no card do board
- **WHEN** card possui tags associadas
- **THEN** chips coloridos das tags são exibidos na área inferior do card no board
