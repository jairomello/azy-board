## MODIFIED Requirements

### Requirement: Worker de execução do agente
O sistema SHALL ter um worker iniciado pelo lifecycle da API que consome a fila persistente de jobs e executa os runs do Azy Agent, separado do ciclo de vida do request HTTP. O callback de execução SHALL reconstruir usuário, tenant, conversa, disponibilidade, governança e modelos a partir do banco; não SHALL confiar em identidade, permissões ou credenciais contidas nos argumentos da fila. O worker SHALL revalidar autorização antes de executar cada tool.

#### Scenario: Worker consome run da fila
- **WHEN** há runs `QUEUED` disponíveis e o worker está ativo
- **THEN** o worker reivindica o run, executa o harness e persiste eventos/resultados

#### Scenario: Worker é iniciado com a API
- **WHEN** `startServer()` inicia no perfil suportado e há runs enfileiradas
- **THEN** o worker é iniciado automaticamente e processa as runs, incluindo a cadeia de modelos ativa do tenant

#### Scenario: Contexto da run vem do banco
- **WHEN** o worker reivindica um run
- **THEN** reconstrói usuário, tenant e conversa por IDs persistidos, carrega governança e modelos atuais do tenant e não usa identidade ou segredo enviados pelo job

#### Scenario: Worker roda no perfil SIMPLE
- **WHEN** a instalação usa o perfil SIMPLE (SQLite, sem serviços externos)
- **THEN** o worker roda in-process no servidor API com claim CAS, sem exigir processo separado

#### Scenario: Worker roda no perfil ADVANCED
- **WHEN** a instalação usa o perfil ADVANCED (PostgreSQL + Redis)
- **THEN** o worker iniciado no servidor pode reivindicar runs pela fila PostgreSQL, usando `FOR UPDATE SKIP LOCKED` quando suportado e sem depender de um processo externo não configurado

#### Scenario: Disponibilidade ou permissão muda antes da execução da tool
- **WHEN** o ROOT desabilita o agente ou a autorização do usuário muda enquanto um run aguarda na fila
- **THEN** o worker revalida o estado atual antes da tool e bloqueia a execução se não for mais permitida
