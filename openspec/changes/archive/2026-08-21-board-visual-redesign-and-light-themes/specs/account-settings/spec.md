## ADDED Requirements

### Requirement: Seção de preferências de aparência
A página `/account` SHALL apresentar uma seção **Aparência** antes da seção de API Keys, contendo o modo claro/escuro e os temas estruturais do modo claro.

#### Scenario: Consultar aparência
- **WHEN** o usuário abre `/account`
- **THEN** a seção mostra o modo atual e os presets Petróleo, Oceano, Esmeralda, Grafite e Clássico
- **AND** o preset ativo possui check, nome e preview visual

#### Scenario: Escolher preset por teclado
- **WHEN** o foco está no grupo de presets
- **THEN** o usuário pode percorrer as opções por teclado e confirmar a seleção
- **AND** o controle expõe semântica de radio group ou equivalente acessível

#### Scenario: Escolher preset durante o modo escuro
- **WHEN** o usuário seleciona um preset claro enquanto o modo escuro está ativo
- **THEN** a escolha é salva
- **AND** a interface informa que o preset será aplicado ao retornar ao modo claro

#### Scenario: Falha ao persistir preferência
- **WHEN** a atualização remota falha
- **THEN** o sistema mantém a aplicação utilizável
- **AND** comunica a falha e oferece nova tentativa
