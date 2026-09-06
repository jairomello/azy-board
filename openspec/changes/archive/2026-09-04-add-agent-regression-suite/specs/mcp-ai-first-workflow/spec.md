## MODIFIED Requirements

### Requirement: Regressão e contrato do catálogo MCP
O projeto SHALL testar o registro das ferramentas, seus schemas, handlers, respostas, documentação e os fluxos recorrentes de mutação contra uma API isolada, sem depender de credenciais reais ou servidor externo. A regressão SHALL incluir criação mínima e completa de projeto, hierarquia individual e em lote, atualizações em lote por filtros e movimentação/reparenting de tasks.

#### Scenario: Catálogo documentado
- **WHEN** a suíte compara o catálogo MCP com o README
- **THEN** não existem ferramentas registradas sem documentação mínima nem ferramentas documentadas inexistentes

#### Scenario: Fluxos recorrentes preservados
- **WHEN** uma alteração estrutural é validada pelo comando padrão do projeto
- **THEN** os testes confirmam que as tools de projeto, criação hierárquica, batch, atualização filtrada e movimentação continuam aceitando os contratos esperados e retornando erros estáveis quando inválidos
