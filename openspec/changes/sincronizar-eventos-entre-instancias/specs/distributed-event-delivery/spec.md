Board ref: 32b627cf-18d5-4d0e-b7fb-323638e8e7e3

## ADDED Requirements

### Requirement: Entrega distribuída consome somente outbox confirmada
ADVANCED SHALL publicar eventos confirmados T38 por CoordinationPort/Valkey e cada API SHALL entregar às suas salas autorizadas sem gerar outro eventId/sequence. Pub/Sub SHALL ser aceleração transitória, não replay ou fila persistente. SIMPLE SHALL usar transporte local sem exigir Valkey. Envelope/canal SHALL ser versionado e escopado por instalação/tenant/projeto.

#### Scenario: Mutação na API A chega a cliente da B
- **WHEN** cliente conectado à API A altera item e cliente autorizado do mesmo projeto está conectado à API B
- **THEN** B recebe via Valkey o evento confirmado e cliente aplica/reconcilia o estado com identidade/sequence de T38

#### Scenario: SIMPLE sem serviço externo
- **WHEN** mutação confirma em SIMPLE sem REDIS_URL
- **THEN** cliente local recebe evento pelo mesmo fluxo pós-commit sem tentativa de conectar Valkey

### Requirement: Consumo deduplicado ordenado e isolado
Subscriber SHALL validar schema/scope, deduplicar eventId/sequence e entregar somente eventos contíguos por tenant/projeto. Fora de ordem SHALL provocar busca limitada da lacuna ou RESYNC, sem renumerar. Handshake/replay/assinatura SHALL validar autorização atual; revogação SHALL interromper entrega e revalidação periódica SHALL impedir membership antiga de manter sala indefinidamente.

#### Scenario: Evento duplicado e fora de ordem
- **WHEN** B recebe n+2 antes de n+1 e n+1 chega duas vezes
- **THEN** B recupera a lacuna, entrega sequência lógica contígua e duplicata não reaplica efeito

#### Scenario: Canal ou payload incoerente
- **WHEN** subscriber recebe envelope de outro tenant/projeto ou versão inválida no canal
- **THEN** rejeita mensagem sem repassar a sala e registra diagnóstico sanitizado

#### Scenario: Acesso revogado
- **WHEN** membership que autorizava sala é removida
- **THEN** evento/revalidação de autorização interrompe entrega e nova consulta de replay é negada

### Requirement: Lag é detectado mesmo sem novo evento
Cada API SHALL comparar high-watermark durável T38 das salas ativas ao progresso local a cada intervalo de heartbeat e após reconectar ao barramento. Diferença SHALL acionar replay/refetch limitado, inclusive se último aviso Pub/Sub foi perdido e nenhum evento posterior chegou. Falha de subscription/Valkey SHALL degradar readiness e sincronização sem descartar outbox confirmada.

#### Scenario: Última mensagem perdida silenciosamente
- **WHEN** último evento publicado não chegou ao subscriber e não há nova mutação
- **THEN** próxima verificação de watermark detecta lag e cliente recupera evento ou ressincroniza

#### Scenario: Restart do subscriber
- **WHEN** API B reinicia com clientes reconectando
- **THEN** recompõe progresso a partir de watermark/replay SQL sem zerar sequência do projeto

#### Scenario: Valkey indisponível e recuperado
- **WHEN** barramento cai e retorna enquanto dados continuam confirmados no banco
- **THEN** API sinaliza degradação, conserva pendências e recompõe todas as salas por comparação/replay antes de indicar sincronização

### Requirement: Operação multi-instância possui prova reproduzível
CI SHALL executar duas APIs ADVANCED e clientes em réplicas distintas com PostgreSQL/Valkey reais, incluindo restart, desconexão, lag, duplicação e refetch falho. Métricas SHALL expor atraso/idade de consumo, gaps, dedup e ressincronização sem segredos. Documentação SHALL condicionar liberação multi-API com agente a T36/T37/T38 verificados e SHALL NOT prometer HA geral com Pub/Sub.

#### Scenario: Ensaio completo de duas APIs
- **WHEN** duas APIs confirmam mutações simultâneas e uma reinicia/perde subscription
- **THEN** clientes convergem ao banco após recuperação, mantêm ordem/isolamento e não mostram synced antes da reconciliação
