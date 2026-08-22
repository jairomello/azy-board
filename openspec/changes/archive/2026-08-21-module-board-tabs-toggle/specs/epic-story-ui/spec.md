## MODIFIED Requirements

### Requirement: Hierarquia visual do board

O sistema SHALL renderizar a hierarquia `Módulo → Épico → História → Cards` no modo `Hierarquia` e SHALL renderizar `Módulo (aba ativa) → Épico → História → Cards` no modo `Abas`, mantendo a mesma estrutura interna de swimlanes.

#### Scenario: Renderização hierárquica

- **WHEN** o modo selecionado é `Hierarquia`
- **THEN** todos os grupos de módulos elegíveis são renderizados com seus épicos e histórias descendentes

#### Scenario: Renderização por aba

- **WHEN** o modo selecionado é `Abas` e uma aba de módulo está ativa
- **THEN** somente o grupo do módulo ativo é renderizado com seus épicos, histórias e BoardColumns

#### Scenario: Criação continua disponível

- **WHEN** o usuário está em qualquer um dos modos de apresentação
- **THEN** os controles de criação de módulo, épico, história, task e bug continuam disponíveis e funcionais
