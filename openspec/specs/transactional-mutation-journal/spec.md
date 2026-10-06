# transactional-mutation-journal Specification

## Purpose
TBD - created by archiving change garantir-mutacoes-idempotentes-transacionais. Update Purpose after archive.
## Requirements
### Requirement: Mutação e journal compartilham uma transação física
Comando mutante SHALL reservar chave, revalidar invariantes necessárias, aplicar domínio/relações, registrar resposta/status, auditoria, analytics aplicável e eventos de outbox no mesmo commit SQLite/PostgreSQL. Unidade de trabalho SHALL usar comandos tipados sem await externo na transação SQLite. Nenhuma etapa SHALL confirmar isoladamente. Pedido sem chave SHALL manter atomicidade dos efeitos, sem promessa de deduplicar intenções distintas.

#### Scenario: Commit completo
- **WHEN** criação de item com relações e chave é confirmada
- **THEN** uma conexão independente encontra item, relações, resposta idempotente, auditoria, analytics e outbox correspondentes juntos

#### Scenario: Falha em qualquer etapa antes do commit
- **WHEN** falha é injetada após reserva, domínio, auditoria, analytics, resposta ou outbox
- **THEN** nenhuma dessas gravações persiste, retry da mesma chave pode executar e não há evento publicado

#### Scenario: Commit sem resposta HTTP
- **WHEN** processo cai depois de commit mas antes de responder
- **THEN** retry autorizado devolve status/body/IDs originais sem outra mutação ou novos efeitos

### Requirement: Unicidade de chave e conflito de payload
Banco SHALL impor unicidade por tenant, ator autenticado, namespace de comando versionado, escopo de projeto explícito e chave. Payload SHALL ser canonicalizado antes de hash e incluir plano/policy/pré-condições semanticamente relevantes. Mesmo payload/chave SHALL convergir a um resultado; payload distinto SHALL retornar HTTP 409 IDEMPOTENCY_CONFLICT. Concorrência SHALL aguardar resultado ou retornar conflito transitório retryable limitado, nunca sucesso com dados extras nem reserva órfã confirmada.

#### Scenario: Duas requisições simultâneas iguais
- **WHEN** duas conexões/processos submetem mesma chave/hash/escopo
- **THEN** há um commit lógico e ambas recuperam o mesmo resultado após aguardar ou repetir conflito transitório

#### Scenario: Mesma chave payload distinto
- **WHEN** a chave já reservada/confirmada recebe outro hash
- **THEN** requisição recebe 409 sem mudar domínio/journal/analytics/outbox

#### Scenario: Escopos independentes
- **WHEN** mesma string de chave é usada por outro tenant, ator ou projeto
- **THEN** não retorna resultado do escopo original e cada intenção autorizada tem identidade própria

#### Scenario: Default de criação muda após commit
- **WHEN** retry ocorre depois de outra sprint/versão se tornar default
- **THEN** retorna vínculos originais armazenados e não recalcula defaults ou cria novo item

### Requirement: Replay autorizado e consulta de estado
Replay e consulta `GET /api/operations/:operationId` SHALL revalidar identidade e acesso atual ao escopo; SHALL NOT expor dados após revogação. Resultado confirmado SHALL preservar status/body/ref/mapa original sem reaplicar pré-condições mutáveis à mesma operação. Metadados aditivos SHALL distinguir commit de dados e publicação pendente, sem transformar falha de notificação em falha da mutação. Headers transitórios/segredos SHALL NOT integrar resposta armazenada.

#### Scenario: Acesso revogado antes de retry
- **WHEN** ator perde autorização depois do primeiro commit
- **THEN** replay/consulta é negado sem divulgar body persistido nem repetir efeito

#### Scenario: Publicação falha depois do commit
- **WHEN** dados foram confirmados mas transporte está indisponível
- **THEN** resposta/consulta informa operação aplicada com publicação pendente e retomada retenta somente efeitos

#### Scenario: Estado alterado após a própria operação
- **WHEN** retry legítimo encontra revisões diferentes por causa do primeiro commit
- **THEN** resultado original é devolvido após autorização, sem exigir nova prévia para aquele replay

### Requirement: Retenção e resultados parciais compatíveis
Journal público SHALL conservar replay por no mínimo 24 h. Operações retomáveis de agente/plano SHALL conservar chave/resultado enquanto puderem retomar e pelo menos 24 h após término; pendências de efeito SHALL NOT ser eliminadas por expiração. Batch atomic=true SHALL reverter todo lote em falha; atomic=false SHALL preservar contrato parcial e gravar resultado integral (sucessos/erros) no mesmo commit do pedido. Replay SHALL NOT retentar implicitamente entradas malsucedidas.

#### Scenario: Batch parcial repetido
- **WHEN** batch não atômico confirmou duas operações e rejeitou outra e pedido é repetido com mesma chave
- **THEN** retorna os mesmos sucessos/erros/IDs e não cria novas operações nem tenta novamente a entrada rejeitada

#### Scenario: Batch atômico falha
- **WHEN** uma operação do lote atomic=true é inválida dentro da tx
- **THEN** lote/journal/efeitos são revertidos sem gravação parcial

#### Scenario: Run retoma depois da janela pública
- **WHEN** agente pode retomar operação cujo resultado tem mais de 24 h
- **THEN** resultado continua disponível para recuperação e não se executa novamente efeito confirmado

### Requirement: Invariantes concorrentes e integração de comandos consumidores
Pré-condições de versão/população fixa, limites, posições, claim e transições SHALL ser verificadas/reservadas na transação adequada, não apenas por leitura anterior. Contexto fenced T37 SHALL ser validado no commit quando presente. Comandos de cadastros, correção de lacunas, transição de sprint e duplicação SHALL consumir o mesmo envelope/journal/outbox, preservando mapas/referências próprios sem base paralela; ferramentas mutantes do agente SHALL usar identidade estável entre retries.

#### Scenario: Limite ou posição disputado
- **WHEN** duas conexões concorrem pela última capacidade de run ou transição/posição exclusiva
- **THEN** invariantes permanecem válidos e conflito é explícito, sem duas reservas/efeitos contraditórios

#### Scenario: Plano alterado e lease obsoleto
- **WHEN** comando aprovado chega com revisão divergente ou fence de geração antiga
- **THEN** tx rejeita sem domínio/journal/efeitos confirmados e exige recuperação/prévia adequada

#### Scenario: Consumidor retorna mapa de cópia
- **WHEN** comando consumidor confirma novos IDs e mapa origem-cópia e é repetido
- **THEN** journal devolve mapa original sem outra cópia; a infraestrutura não implementa nem reinventa o domínio do consumidor

