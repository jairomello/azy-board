Board ref: 8ee60cea-aa36-4b87-bb0d-e743e5e3e367

## ADDED Requirements

### Requirement: Evento confirmado possui identidade e sequência duráveis
Toda mutação que afeta dados exibidos SHALL incluir envelope de evento ou invalidação suficiente na mesma transação do domínio. Envelope SHALL conter eventId, operationId/correlationId, tenantId/projectId, schemaVersion, tipo/payload e sequence monotônica por tenant/projeto, alocada sob lock/tx e única no banco. Rota SHALL NOT gerar sequência local ou publicar evento antes do commit. Rollback SHALL NOT deixar evento fantasma; outbox de limpeza de storage SHALL continuar com responsabilidade própria.

#### Scenario: Dois comandos no mesmo projeto
- **WHEN** comandos concorrentes confirmam na mesma instalação/projeto
- **THEN** eventos têm sequências únicas ordenadas pelo commit e identidades estáveis, sem depender do processo API

#### Scenario: Rollback de mutação
- **WHEN** comando é revertido após preparar envelope
- **THEN** evento não aparece no replay/dispatcher e nenhum cliente é notificado de estado inexistente

#### Scenario: Mutação de metadados ou checklist
- **WHEN** membro/squad/sprint/checklist muda por comando confirmado
- **THEN** evento/invalidação da seção pertinente fica durável junto do commit, com tenant/projeto corretos

### Requirement: Despacho pós-commit recuperável e idempotente
Dispatcher SHALL consumir somente registros confirmados, reivindicar lote com lease, publicar e persistir ack/tentativas/backoff. Entrega SHALL ser at-least-once com mesma identidade/sequence em cada repetição; consumidores SHALL deduplicar. Falha de transporte ou crash SHALL NOT repetir mutação. Pendência persistente SHALL ser observável/reprocessável sem descarte silencioso. SIMPLE SHALL entregar pelo transporte local; integração distribuída ADVANCED SHALL usar T39 sem outra outbox.

#### Scenario: Crash antes da publicação
- **WHEN** processo cai após commit e antes de dispatcher publicar
- **THEN** novo dispatcher publica o mesmo evento pendente sem repetir dados/auditoria/analytics

#### Scenario: Crash após publish antes do ack
- **WHEN** transporte aceitou evento mas ack não foi persistido
- **THEN** retry pode republicar mesmo eventId/sequence e consumidor não duplica efeito

#### Scenario: Dois dispatchers competem
- **WHEN** dois processos buscam mesmo lote e lease expira durante publicação
- **THEN** reivindicação/ack são condicionais e eventual duplicata conserva identidade para dedup, sem evento novo

### Requirement: Replay confirmado e retenção separados do ack
Outbox/replay SHALL permitir consulta paginada tenant-scoped de eventos confirmados por cursor, conservar histórico por pelo menos 24 h e contador permanente, e limitar reconciliação a 1.000 eventos antes de exigir refetch. Registros não despachados SHALL NOT ser podados. Ack SHALL significar aceitação pelo transporte, não recebimento por todo cliente. Lacuna/retenção excedida SHALL ser explícita para consumidor T39.

#### Scenario: Cursor dentro da retenção
- **WHEN** consumidor autorizado pede eventos após cursor ainda coberto
- **THEN** recebe sequência confirmada paginada e watermark do projeto, sem depender de Valkey ou buffer de API

#### Scenario: Retenção ou limite excedido
- **WHEN** cursor antecede eventos retidos ou exige mais de 1.000 eventos
- **THEN** consumidor recebe indicação de refetch, sem replay truncado apresentado como completo

#### Scenario: Transporte confirma mas cliente perde mensagem
- **WHEN** ack de publicação existe mas socket não recebeu último evento
- **THEN** evento segue acessível no replay retido e reconciliação não considera ack prova de entrega ao socket

### Requirement: Integridade operacional da outbox
Sistema SHALL medir pendências/idade/tentativas e falhas de dispatcher e restringir replay/reprocessamento por tenant/projeto/autorização. Payload SHALL ser versionado, validável e sem segredos; falha permanente SHALL ter diagnóstico sanitizado e caminho de reprocessamento. Auditoria/analytics persistentes SHALL NOT depender do sucesso de transporte externo.

#### Scenario: Falha prolongada de publisher
- **WHEN** publicação falha repetidamente
- **THEN** pendências e idade são visíveis, dados/auditoria/analytics permanecem consistentes e reprocessamento retoma efeitos sem repetir domínio

#### Scenario: Replay cross-tenant
- **WHEN** ator tenta consultar/reprocessar evento de tenant/projeto sem acesso
- **THEN** operação é negada sem payload ou efeitos cruzados
