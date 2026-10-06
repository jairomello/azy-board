Board ref: 32b627cf-18d5-4d0e-b7fb-323638e8e7e3

## MODIFIED Requirements

### Requirement: Isolamento por projeto
Sistema SHALL garantir isolamento de eventos, salas, cursores, replay e canais por tenant e projeto. Handshake/replay SHALL revalidar identidade/membership/gerência/grupos segundo autorização REST; subscription interna SHALL NOT conceder acesso a cliente. Nenhum evento SHALL ser entregue a projeto/tenant diferente, mesmo sob deduplicação/reconexão.

#### Scenario: Isolamento de eventos entre projetos
- **WHEN** card é movido no Projeto A
- **THEN** usuários conectados ao Projeto B não recebem o evento

#### Scenario: Isolamento entre tenants em APIs diferentes
- **WHEN** clientes de tenants diferentes estão em réplicas distintas e um solicita cursor/eventos do outro tenant
- **THEN** handshake/replay é negado sem expor payload e o broadcast não cruza salas

### Requirement: Eventos ordenados e replay por cursor
Sistema SHALL numerar eventos confirmados com sequence durável monotônica por tenant/projeto alocada por T38 e SHALL usar replay persistido limitado, sem depender de buffer do processo. Cliente SHALL informar último cursor aplicado, deduplicar eventos e validar continuidade. Replay SHALL reenviar posteriores em ordem com barreira até watermark; lacuna/cursor inválido/à frente/legado, retenção excedida ou mais de 1.000 eventos SHALL exigir RESYNC_REQUIRED e refetch das consultas ativas. Retenção SHALL ser no mínimo 24 h e contador SHALL sobreviver restart. Servidor SHALL bufferizar live durante replay/refetch e só concluir após barreira/ack compatíveis, sem corrida de snapshot ou evento. Essas operações SHALL ser reconciliação normal, não erro alarmante ao usuário.

#### Scenario: Queda curta é coberta por replay
- **WHEN** cliente reconecta com cursor ainda coberto pelo histórico persistido
- **THEN** servidor reenvia eventos posteriores em ordem, ainda que cliente tenha mudado de API

#### Scenario: Queda longa dispara ressincronização
- **WHEN** cursor está fora da retenção ou excede limite de replay
- **THEN** servidor envia RESYNC_REQUIRED e cliente refaz consultas ativas do projeto sem aceitar replay parcial como completo

#### Scenario: Servidor reiniciado ressincroniza
- **WHEN** cliente reconecta com cursor maior que watermark durável ou legado incompatível após restart/cutover
- **THEN** ressincroniza por refetch em vez de aplicar eventos fora de ordem; cursor válido retido usa replay persistido sem zerar contador

#### Scenario: Aplicação idempotente de replay
- **WHEN** evento já aplicado volta por Pub/Sub/replay
- **THEN** cliente ignora duplicata sem regressão do estado/cursor

#### Scenario: Lacuna durante conexão viva
- **WHEN** cliente recebe sequence acima de cursor+1
- **THEN** não aplica como contígua e solicita replay/refetch mantendo estado syncing

#### Scenario: Mutação durante refetch
- **WHEN** outra API confirma evento enquanto consultas ativas estão sendo refeitas
- **THEN** protocolo compara revisão/watermark e reconcilia live bufferizado antes de completar, sem perder evento nem regredir snapshot

### Requirement: Estado de sincronização honesto na UI
Web SHALL distinguir conectado de dados reconciliados por estados connecting → syncing → synced ou offline. Synced SHALL exigir replay contíguo aplicado até watermark ou refetch bem-sucedido com barreira/ack; falha/ausência de refetch SHALL NOT virar sucesso. Gap/lag SHALL retornar a syncing e resultados de geração antiga de socket/projeto SHALL ser descartados. UI SHALL indicar sincronização enquanto recuperação estiver pendente.

#### Scenario: Conectar não é o mesmo que estar sincronizado
- **WHEN** WebSocket abre mas replay/refetch/barreira não terminou
- **THEN** UI exibe sincronização em andamento, não Sincronizado

#### Scenario: Sincronizado só após reconciliação
- **WHEN** replay contíguo ou refetch/barreira conclui para geração atual
- **THEN** UI passa a exibir Sincronizado

#### Scenario: Queda mostra estado offline sem alarme de erro
- **WHEN** conexão cai e reconexão automática inicia
- **THEN** UI reflete offline/connecting sem tratar reconciliação como falha de aplicação

#### Scenario: Refetch falha
- **WHEN** uma consulta necessária à ressincronização falha
- **THEN** cliente permanece syncing e retenta reconciliação, sem converter catch em synced

#### Scenario: Resposta de socket anterior
- **WHEN** refetch iniciado no projeto/socket anterior termina após troca de projeto ou reconexão
- **THEN** resultado antigo não altera cursor/status/estado da conexão atual

#### Scenario: Carga inicial concorre com mutação
- **WHEN** evento confirma entre leitura inicial do board e abertura do canal
- **THEN** cliente reconcilia snapshot/watermark antes de synced e apresenta estado atualizado
