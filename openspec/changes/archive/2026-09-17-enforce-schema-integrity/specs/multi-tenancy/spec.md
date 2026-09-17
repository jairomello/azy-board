## ADDED Requirements

### Requirement: Isolamento garantido pela camada de banco
Além do filtro de query, o schema SHALL representar o isolamento multi-tenant por chaves estrangeiras compostas com `tenant_id`, de modo que vínculos cross-tenant sejam rejeitados mesmo quando a aplicação falha.

#### Scenario: Aplicação ou script tenta vínculo cross-tenant
- **WHEN** uma escrita direta no banco, script de seed ou rota com bug tenta associar entidade a um pai de outro tenant
- **THEN** o banco rejeita a operação por violação de chave estrangeira, independentemente do filtro de aplicação

#### Scenario: Chaves compostas presentes nas relações
- **WHEN** o schema é inspecionado
- **THEN** as relações filho→pai usam `(tenant_id, <parent_id>)` e as tabelas pai possuem `UNIQUE (tenant_id, id)`
