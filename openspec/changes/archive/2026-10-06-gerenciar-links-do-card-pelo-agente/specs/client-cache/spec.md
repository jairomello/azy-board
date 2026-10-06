## ADDED Requirements

### Requirement: Recursos do item reagem a mutações do assistente

Componentes que exibem recursos do item obtidos por consulta própria (como os links do card) SHALL reagir ao evento de mutação concluída do assistente, refazendo a consulta do recurso afetado quando a ferramenta de mutação corresponder ao recurso e ao item exibido, sem exigir recarregamento manual da tela. O recarregamento SHALL filtrar pelo item afetado quando o resultado da ferramenta identificar o item e o projeto; na ausência dessa identificação, o componente PODE recarregar de forma conservadora. A atualização NÃO SHALL ser apresentada ao usuário como erro nem apagar alterações locais pendentes.

#### Scenario: Aba Links atualiza após criação pelo agente

- **WHEN** o agente conclui `create_item_link` e a aba Links do item afetado está aberta
- **THEN** a lista de links é recarregada e o novo link aparece sem recarregamento manual

#### Scenario: Aba Links atualiza após edição e remoção

- **WHEN** o agente conclui `update_item_link` ou `delete_item_link` para o item exibido na aba Links
- **THEN** a lista reflete a alteração ou a remoção sem recarregamento manual

#### Scenario: Mutação de outro item não recarrega o item exibido

- **WHEN** o assistente muta link de um item diferente do exibido e o resultado identifica o item
- **THEN** o componente do item exibido não refaz a consulta desnecessariamente

#### Scenario: Outra ferramenta não dispara recarregamento de links

- **WHEN** o assistente conclui uma ferramenta que não é de mutação de link
- **THEN** a aba Links não refaz a consulta por causa desse evento
