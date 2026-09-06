## Purpose

Definir os requisitos da capacidade sprint management.
## Requirements
### Requirement: CRUD de sprints
O sistema SHALL manter criação, edição, abertura, suspensão implícita e encerramento de sprints com os campos/formulários atuais. Cada transição para `OPEN` SHALL iniciar um ciclo analítico; abrir outra sprint SHALL encerrar o ciclo ativo anterior como `SUSPENDED` e rebaixar sua sprint para `PROPOSED`; fechar SHALL encerrar o ciclo como `CLOSED`.

#### Scenario: Criação de sprint
- **WHEN** admin cria sprint com nome, data início e data fim válidos
- **THEN** sistema registra status `PROPOSED` sem ciclo analítico

#### Scenario: Datas inválidas
- **WHEN** usuário tenta criar ou editar sprint sem uma data ou com início posterior ao fim
- **THEN** sistema rejeita a alteração sem persistência parcial

#### Scenario: Edição de sprint
- **WHEN** Admin edita nome ou datas
- **THEN** sistema mantém status e ciclos analíticos existentes

#### Scenario: Abertura de sprint sem outra aberta
- **WHEN** admin abre sprint `PROPOSED`
- **THEN** sistema muda para `OPEN` e cria ciclo/baseline `OPENED` atomicamente

#### Scenario: Troca da sprint aberta
- **WHEN** admin abre sprint B enquanto sprint A está `OPEN`
- **THEN** sistema encerra ciclo de A como `SUSPENDED`, rebaixa A para `PROPOSED`, abre B e cria ciclo de B na mesma transação

#### Scenario: Reabrir sprint suspensa
- **WHEN** sprint anteriormente suspensa em `PROPOSED` volta a `OPEN`
- **THEN** sistema cria novo ciclo sem sobrescrever os ciclos anteriores

#### Scenario: Sprint fechada não reabre
- **WHEN** usuário tenta abrir sprint `CLOSED`
- **THEN** sistema rejeita a transição e preserva ciclos existentes

#### Scenario: Encerramento de sprint
- **WHEN** admin encerra sprint `OPEN`
- **THEN** sistema muda para `CLOSED` e encerra ciclo ativo como `CLOSED` na mesma transação

### Requirement: Consulta de sprint ativa por agentes de IA
O sistema SHALL expor endpoint dedicado `GET /projects/{id}/current-sprint` retornando dados da sprint ativa de forma minimalista.

#### Scenario: Sprint ativa encontrada
- **WHEN** agente de IA consulta current-sprint de um projeto com sprint ativa
- **THEN** sistema retorna `{ id, name, startDate, endDate, status: "OPEN" }` em JSON

#### Scenario: Sem sprint ativa
- **WHEN** agente consulta current-sprint e não há sprint ativa
- **THEN** sistema retorna `{ status: "NONE" }` com HTTP 200

---

### Requirement: Associação de cards a sprints
O sistema SHALL permitir incluir e remover cards de uma sprint `PROPOSED` ou `OPEN`, respeitando projeto e tenant. O sistema SHALL rejeitar qualquer nova associação a sprint `CLOSED`, inclusive durante a criação ou edição de um item.

#### Scenario: Inclusão de card em sprint
- **WHEN** membro adiciona card à sprint `PROPOSED` ou `OPEN`
- **THEN** card é associado à sprint e aparece no filtro de sprint do board

#### Scenario: Inclusão em sprint fechada
- **WHEN** usuário tenta adicionar ou mover card para sprint `CLOSED`
- **THEN** sistema retorna 409 ou 422 e não cria nem altera a associação

#### Scenario: Criação de task sem sprint
- **WHEN** card é criado sem sprint
- **THEN** card é criado normalmente sem associação a sprint

#### Scenario: Listagem de sprints
- **WHEN** usuário autorizado consulta sprints do projeto
- **THEN** sistema retorna sprints `PROPOSED`, `OPEN` e `CLOSED` para permitir consulta histórica

#### Scenario: Card sem sprint
- **WHEN** card não está associado a nenhuma sprint
- **THEN** card aparece apenas na visão "Todos" do board, não no filtro de sprint

### Requirement: Ciclo e baseline mínimo de sprint
Cada `sprint_cycle` SHALL conter `startedAt`, `endedAt` nullable, `endReason` nullable (`SUSPENDED|CLOSED`) e fonte (`OPENED|MIGRATION`). O cabeçalho SHALL existir mesmo sem itens. `sprint_cycle_items` SHALL guardar itemId histórico sem FK restritiva, tipo, condição de folha, pontos, status, módulo e versão no início do ciclo.

#### Scenario: Ciclo com escopo
- **WHEN** sprint com itens é aberta
- **THEN** cabeçalho e snapshots das folhas associadas são persistidos atomicamente

#### Scenario: Ciclo de sprint vazia
- **WHEN** sprint sem itens é aberta
- **THEN** cabeçalho `OPENED` é persistido com zero itens e permanece distinguível de ausência de ciclo

#### Scenario: Sprint aberta durante migração
- **WHEN** migração encontra sprint `OPEN`
- **THEN** cria ciclo `MIGRATION` parcial iniciado em `coverageStartedAt`, sem afirmar compromisso original

#### Scenario: Sprint fechada legada
- **WHEN** migração encontra sprint `CLOSED`
- **THEN** não cria ciclo fictício

#### Scenario: Item excluído após baseline
- **WHEN** item do ciclo é excluído posteriormente
- **THEN** snapshot do ciclo permanece disponível enquanto o projeto existir

### Requirement: Associação de item e sprint sem duplicidade
O sistema SHALL manter no máximo uma associação por par `(itemId, sprintId)`. A migração SHALL deduplicar pares existentes de forma auditável antes de aplicar unicidade.

#### Scenario: Base com associação duplicada
- **WHEN** migração encontra duas linhas para o mesmo item e sprint
- **THEN** preserva uma associação, registra a normalização e adiciona constraint única

#### Scenario: Inserção duplicada após migração
- **WHEN** cliente tenta associar novamente o mesmo item à mesma sprint
- **THEN** operação é idempotente ou rejeitada sem criar linha adicional
