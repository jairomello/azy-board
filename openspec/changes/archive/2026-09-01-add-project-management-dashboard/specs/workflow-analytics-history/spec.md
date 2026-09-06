## ADDED Requirements

### Requirement: Eventos mínimos append-only
O sistema SHALL persistir eventos `ANALYTICS_BASELINE`, `ITEM_CREATED`, `STATUS_CHANGED`, `POINTS_CHANGED`, `TYPE_CHANGED`, `SPRINT_CHANGED`, `VERSION_CHANGED`, `ITEM_REPARENTED`, `MODULE_CHANGED`, `LEAF_CHANGED`, `ITEM_ARCHIVED`, `ITEM_UNARCHIVED` e `ITEM_DELETED` na mesma transação da mutação correspondente.

#### Scenario: Mutação por qualquer entrada
- **WHEN** UI, REST, MCP, batch ou Shadow Markdown executa mutação coberta
- **THEN** evento estruturado é persistido com a mesma atomicidade

#### Scenario: Alteração da condição de folha
- **WHEN** criação, exclusão ou reparenting do primeiro/último filho altera a condição de folha do pai antigo ou novo
- **THEN** sistema registra `LEAF_CHANGED` anterior/posterior para todos os itens diretamente afetados

#### Scenario: Conversão do modo de projeto
- **WHEN** conversão SIMPLE/HIERARCHICAL reparenta ou remove níveis da árvore
- **THEN** serviço registra eventos para os itens e condições de folha afetados sem dupla contagem

#### Scenario: Mutação em cascata ou subárvore
- **WHEN** reparenting muda módulo efetivo de descendentes ou archive/unarchive/delete afeta uma subárvore
- **THEN** sistema grava evento para cada item cujo estado analítico mudou, além dos pais cuja condição de folha mudou

#### Scenario: Falha no evento
- **WHEN** evento obrigatório não pode ser gravado
- **THEN** mutação corrente é revertida sem alterar os demais dados existentes

### Requirement: Conteúdo e isolamento do evento
Cada evento de item SHALL conter `tenantId`, `projectId`, `itemId`, `eventType`, `occurredAt` UTC, sequência/id estável, ator humano/API key ou `SYSTEM`, origem, `correlationId` e snapshots anterior/posterior mínimos de `parentId`, tipo, condição de folha, status, pontos, conjunto deduplicado de sprintIds, versão e módulo efetivo. O evento de cobertura/baseline de projeto pode ter `itemId = null`. Ator `SYSTEM` SHALL ser permitido somente para migração/processo interno; mutações autenticadas exigem ator real. Toda consulta SHALL restringir tenant e projeto.

#### Scenario: Item excluído
- **WHEN** item é excluído
- **THEN** eventos permanecem disponíveis sem FK cascade e sem reter descrição/conteúdo desnecessário

#### Scenario: Projeto excluído
- **WHEN** projeto ou tenant é excluído
- **THEN** cobertura, eventos e baselines correspondentes são removidos por cascade ou limpeza transacional sem bloquear a exclusão

#### Scenario: Consulta cross-tenant
- **WHEN** agregação referencia evento de outro tenant/projeto
- **THEN** evento não é retornado nem contabilizado

### Requirement: Marco de cobertura e baseline
O sistema SHALL registrar uma entidade de cobertura com `coverageStartedAt` e baseline corrente por projeto no deploy, inclusive para projeto vazio, sem inferir eventos anteriores por `updatedAt` ou logs textuais.

#### Scenario: Projeto existente
- **WHEN** migração encontra projeto com itens
- **THEN** baseline registra o estado observado e declara indisponível o período anterior

#### Scenario: Projeto novo
- **WHEN** projeto é criado após a migração
- **THEN** cobertura inicia na criação e eventos posteriores são completos

#### Scenario: Baseline de migração
- **WHEN** migração cria baseline sem usuário autenticado
- **THEN** evento usa ator `SYSTEM` e origem `MIGRATION`

### Requirement: Histórico para burnup
O sistema SHALL reconstruir o estado ao fim de cada dia UTC, ordenando eventos por `(occurredAt, sequence/id)`. Escopo total SHALL ser a população dinâmica de folhas `TASK`/`BUG` não arquivadas; concluído SHALL ser o subconjunto em `DONE`. Criação/restauração SHALL aumentar escopo elegível e arquivo/exclusão SHALL reduzi-lo. Valores anteriores SHALL permanecer reproduzíveis após mudanças posteriores.

#### Scenario: Reclassificação de versão
- **WHEN** item muda de versão
- **THEN** períodos anteriores usam versão snapshot anterior e posteriores usam a nova

#### Scenario: Item torna-se pai
- **WHEN** folha ganha filho
- **THEN** eventos posteriores refletem a nova condição de folha sem reescrever snapshots anteriores

### Requirement: Histórico para aging WIP
O sistema SHALL medir o episódio ativo atual: entrada em `IN_PROGRESS` ou `BLOCKED` inicia o episódio; transições entre esses dois status não zeram a idade; saída para `NOT_STARTED`, `DONE`, `CANCELLED` ou `ARCHIVED` encerra o episódio; nova entrada, inclusive restauração direta para estado ativo, inicia outro.

#### Scenario: Item ativo no baseline
- **WHEN** não existe transição observada de início
- **THEN** analytics marca início desconhecido e usa `coverageStartedAt` somente como limite inferior

#### Scenario: Item iniciado normalmente
- **WHEN** item entra em trabalho após cobertura
- **THEN** primeiro evento ativo define o início observado do aging

#### Scenario: Item concluído e reaberto
- **WHEN** item sai do WIP para `DONE` e posteriormente entra novamente em `IN_PROGRESS`
- **THEN** aging usa o início do novo episódio ativo, sem carregar a idade do episódio encerrado

### Requirement: Índices e retenção
O sistema SHALL indexar eventos por tenant/projeto/item/data/tipo, limitar períodos consultáveis e manter agregados reconstruíveis a partir da fonte append-only.

#### Scenario: Período excessivo
- **WHEN** cliente solicita intervalo acima do limite suportado
- **THEN** API exige período menor e não executa consulta sem limite

### Requirement: Corte consistente de ativação
O sistema SHALL concluir migração, cobertura e baseline antes de aceitar writers da nova versão e SHALL impedir writers antigos durante o corte, evitando mutações entre baseline e dual-write.

#### Scenario: Mutação concorrente ao deploy
- **WHEN** ativação analítica está capturando baseline
- **THEN** mutação aguarda o fim do corte ou já grava evento, sem criar janela sem histórico
