## ADDED Requirements

### Requirement: Plano compartilhado de exclusao

O sistema SHALL usar uma politica centralizada para excluir um item e seus descendentes ou um projeto e seus registros dependentes. O plano SHALL resolver todos os IDs dentro do `tenantId` autenticado antes de modificar dados e SHALL ser executado em uma unica transacao do banco.

#### Scenario: Exclusao de item com subarvore
- **WHEN** um membro autorizado exclui um item que possui filhos, netos e checklists
- **THEN** o sistema exclui toda a subarvore e suas relacoes dependentes sem deixar registros referenciando os itens removidos

#### Scenario: Exclusao de projeto com todos os recursos
- **WHEN** um administrador autorizado exclui um projeto
- **THEN** o sistema remove os itens, relacoes, configuracoes e conversas pertencentes ao projeto sem consultar ou excluir dados de outro tenant

#### Scenario: Falha durante a transacao
- **WHEN** uma constraint ou erro de banco ocorre durante a exclusao
- **THEN** o sistema faz rollback de todos os deletes e retorna erro sem alterar parcialmente a arvore

### Requirement: Politica explicita de FKs

Toda tabela filha relacionada a itens ou projetos SHALL ter uma politica documentada e testada: cascata pelo banco quando for dependencia exclusiva, ou delete explicito no plano quando exigir ordenacao, coleta de dados ou semantica especial.

#### Scenario: Nova relacao dependente e coberta
- **WHEN** uma tabela filha e adicionada ao schema
- **THEN** a migration e o teste de integridade identificam sua politica de exclusao antes da funcionalidade ser considerada concluida

#### Scenario: Referencia especial do projeto
- **WHEN** um item referenciado por `simple_story_id` sera removido
- **THEN** o sistema limpa a referencia antes do delete do item e mantem a constraint valida

### Requirement: Limpeza pos-commit de storage

Quando a exclusao remover metadados de anexos, o sistema SHALL registrar cada `storagePath` em uma fila persistente na mesma transacao do banco. O processamento SHALL ocorrer apos o commit, tratar arquivo inexistente como sucesso e permitir retry idempotente quando o adapter falhar.

#### Scenario: Delete de anexo apos item confirmado
- **WHEN** um item com anexos e excluido com sucesso no banco
- **THEN** os metadados desaparecem atomicamente e jobs correspondentes ficam disponiveis para remover os arquivos fisicos

#### Scenario: Storage indisponivel
- **WHEN** o banco confirma a exclusao mas `storage.delete` falha temporariamente
- **THEN** o endpoint nao desfaz a exclusao do banco, o job fica pendente com erro e uma tentativa posterior pode conclui-lo

#### Scenario: Reprocessamento de job concluido
- **WHEN** o mesmo job e entregue mais de uma vez ou o arquivo ja nao existe
- **THEN** o processamento permanece seguro, marca o job como concluido e nao cria efeitos duplicados

### Requirement: Auditoria de integridade de exclusao

O sistema SHALL oferecer verificacoes de leitura para detectar anexos, checklists, relacoes e logs sem pai; referencias com `tenantId` inconsistente; e jobs de storage pendentes alem do limite operacional.

#### Scenario: Banco sem orfaos
- **WHEN** a auditoria e executada em uma base integra
- **THEN** ela retorna contagens zero para orfaos e nenhuma referencia entre tenants

#### Scenario: Orfao detectado
- **WHEN** existe metadado sem pai ou job vencido
- **THEN** a auditoria retorna o tipo, tenant, identificador e motivo sem apagar o registro automaticamente
