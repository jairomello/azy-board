Board ref: c7156663-1b21-44ed-9dfb-77a207ac9086

## ADDED Requirements

### Requirement: Garantias operacionais vinculadas à versão e evidência
Documentação de release SHALL identificar garantias e limites por perfil como verificados, limitados ou pendentes, vinculando cada garantia verificada a teste/comando, evidência de execução, SHA e data. README/DEPLOY/TESTING SHALL referenciar fontes geradas para limites voláteis e descrever rollback/restore compatível com schema. Diagnósticos históricos SHALL estar sinalizados e ligados à revisão atual e cards de continuidade. Checker SHALL validar links/metadados da matriz e rejeitar status verificado sem prova, além dos contratos existentes de integridade.

#### Scenario: Promessa sem prova
- **WHEN** documentação marca suporte/garantia como verificado sem teste ou evidência aplicável à versão/perfil
- **THEN** gate documental falha ou exige reclassificação explícita para limitado/pendente, sem inventar execução

#### Scenario: Análise histórica consultada
- **WHEN** leitor abre análise original de setembro
- **THEN** encontra sinalização de diagnóstico histórico, ligação para revisão de 2026-10-05 e continuidade T36–T43

#### Scenario: Release com evidência e recuperação
- **WHEN** release candidata é preparada
- **THEN** definição de pronto exige gates essenciais, prova da proteção efetiva, smoke/restore por perfil e documentação de limites/rollback vinculada ao SHA antes de declará-la verificada
