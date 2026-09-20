## MODIFIED Requirements

### Requirement: Gates de contrato sincronizados

O workflow SHALL executar gates que detectam divergencia de contratos antes do merge: verificacao de i18n, testes de migration, validacao do catalogo MCP, verificacao da skill de agente e verificacao do orcamento de bundle do web. Qualquer divergencia SHALL reprovar o job correspondente.

#### Scenario: Texto fora do i18n
- **WHEN** a verificacao de i18n encontra texto localizado fora dos arquivos de idioma
- **THEN** o gate de i18n falha e o pull request fica bloqueado

#### Scenario: Migration inconsistente
- **WHEN** o teste de migrations detecta schema, journal ou snapshot divergente
- **THEN** o gate de migrations falha e o pull request fica bloqueado

#### Scenario: Catalogo MCP divergente
- **WHEN** o catalogo MCP difere do registry de ferramentas
- **THEN** o gate de catalogo MCP falha e o pull request fica bloqueado

#### Scenario: Skill de agente divergente
- **WHEN** a skill oficial do agente diverge do comportamento verificado
- **THEN** o gate da skill de agente falha e o pull request fica bloqueado

#### Scenario: Orcamento de bundle ultrapassado
- **WHEN** a verificacao de orcamento detecta um chunk do web acima do limite versionado
- **THEN** o gate de bundle falha e o pull request fica bloqueado
