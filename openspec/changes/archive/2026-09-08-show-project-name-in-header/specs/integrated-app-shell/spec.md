## MODIFIED Requirements

### Requirement: Continuidade do workspace principal
O sistema SHALL preservar a área principal do `AppShell`, incluindo os slots opcionais `commandBar` e `statusRail`, sem sobreposição, corte ou perda do comportamento de scroll após a integração do header com a sidebar. Em telas associadas a um projeto, o título contextual principal SHALL exibir o nome do projeto limitado visualmente a 60 caracteres; quando o projeto não estiver disponível, SHALL manter o `contextLabel` como fallback.

#### Scenario: Página com command bar e status rail
- **WHEN** uma página fornece `commandBar` e `statusRail`
- **THEN** ambos aparecem na coluna principal, abaixo do header e nas posições atuais relativas ao conteúdo
- **AND** somente a região apropriada da página rola dentro da altura disponível

#### Scenario: Página sem slots opcionais
- **WHEN** uma página não fornece `commandBar` ou `statusRail`
- **THEN** o conteúdo ocupa a coluna principal sem reservar espaços vazios indevidos

#### Scenario: Nome do projeto no header
- **WHEN** uma tela project-scoped possui `projectId` e `projectName`
- **THEN** o título contextual principal exibe o nome do projeto em vez do texto genérico de fluxo

#### Scenario: Nome maior que 60 caracteres
- **WHEN** o nome do projeto possui mais de 60 caracteres
- **THEN** o texto visual é truncado para no máximo 60 caracteres
- **AND** o nome completo permanece disponível por tooltip ou atributo acessível

#### Scenario: Tela sem projeto
- **WHEN** uma tela global não possui projeto atual
- **THEN** o header mantém o `contextLabel` e não reutiliza o nome de projeto anterior
