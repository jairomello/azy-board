## ADDED Requirements

### Requirement: Isolamento entre projetos do mesmo tenant

O sistema SHALL tratar `tenant_id` e `project_id` como escopos independentes em toda query de negócio. Conhecer um ID de entidade de outro projeto não SHALL permitir leitura, alteração, associação, exclusão, claim, movimento ou consulta de logs/checklists.

#### Scenario: Operação com projeto incorreto
- **WHEN** cliente autenticado chama uma rota com membership no projeto A e ID de entidade do projeto B
- **THEN** sistema retorna HTTP 404 e não altera dados de A ou B

#### Scenario: Associação de entidade externa
- **WHEN** cliente tenta associar item do projeto A a coluna, sprint, tag, versão, módulo ou pai do projeto B
- **THEN** sistema retorna erro de validação e mantém o estado original

### Requirement: WebSocket exige membership

O upgrade WebSocket SHALL validar JWT/API Key, tenant, membership no projeto solicitado e papel mínimo antes de aceitar a conexão. Broadcast SHALL permanecer restrito ao projeto e tenant da conexão.

#### Scenario: Usuário sem membership solicita conexão
- **WHEN** usuário autenticado solicita WebSocket informando projeto sem membership
- **THEN** servidor rejeita o upgrade com HTTP 404 ou 403 conforme a política de não revelação

#### Scenario: Broadcast isolado
- **WHEN** evento é publicado em um projeto
- **THEN** somente conexões autorizadas daquele projeto e tenant recebem o evento
