## Purpose

Definir os requisitos da capacidade realtime sync.
## Requirements
### Requirement: Sincronização em tempo real via WebSocket
O sistema SHALL manter conexões WebSocket por projeto e transmitir eventos de mudança para todos os participantes conectados (humanos e agentes de IA).

#### Scenario: Card movido por humano visível para todos
- **WHEN** usuário move card por drag-and-drop no board
- **THEN** todos os outros usuários conectados ao mesmo projeto veem o card se mover em tempo real sem necessidade de refresh

#### Scenario: Card movido por agente de IA visível para humanos
- **WHEN** agente de IA move card via API REST ou MCP
- **THEN** board dos usuários humanos atualiza instantaneamente refletindo a mudança

---

### Requirement: Tipos de eventos WebSocket
O sistema SHALL emitir eventos tipados para toda mutação que afete dados exibidos: criação, movimentação, atualização e exclusão de itens, claim/release de task, alteração de checklist, mudanças de sprint (inclusive ativação/abertura/fechamento) e mudanças de metadados do projeto (colunas, módulos, tags, versões, membros, squads, centros de custo e configurações). O contrato SHALL NOT conter tipos de evento nunca emitidos; payloads de eventos SHALL ser aplicáveis pelo cliente.

#### Scenario: Evento de claim de task
- **WHEN** agente de IA faz claim de uma task
- **THEN** card no board de todos os participantes atualiza o responsável e exibe o badge de IA em tempo real

#### Scenario: Mudança de sprint ativa é transmitida
- **WHEN** uma sprint é ativada, aberta, fechada ou editada
- **THEN** os participantes conectados recebem o evento e as telas afetadas são atualizadas

#### Scenario: Metadados do projeto sincronizam as telas
- **WHEN** uma coluna, módulo, tag, versão, membro, squad ou centro de custo é criado, editado ou excluído
- **THEN** as telas que consomem esses metadados recebem o evento e atualizam sem recarregamento manual

#### Scenario: Sem tipos legados no contrato
- **WHEN** o contrato de eventos é inspecionado
- **THEN** não existem tipos declarados que nenhuma rota emite nem payloads que o cliente descarta silenciosamente

### Requirement: Reconexão automática
O sistema SHALL suportar reconexão automática do cliente WebSocket com backoff exponencial persistente entre tentativas (com limite máximo), reiniciado somente após conexão estável. Ao reconectar, o cliente SHALL reconciliar o estado por replay de eventos ou por ressincronização (refetch das consultas ativas).

#### Scenario: Reconexão após queda de rede
- **WHEN** conexão WebSocket do cliente é interrompida
- **THEN** cliente tenta reconectar automaticamente e, ao reconectar, reconcilia as mudanças perdidas por replay ou ressincronização

#### Scenario: Backoff cresce entre tentativas
- **WHEN** sucessivas tentativas de reconexão falham
- **THEN** o intervalo entre tentativas dobra até o limite máximo, sem reiniciar o atraso a cada tentativa

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

### Requirement: Heartbeat e detecção de conexão zumbi
O sistema SHALL manter heartbeat de aplicação entre servidor e cliente e SHALL tratar conexão sem tráfego dentro do intervalo de tolerância como queda, disparando a reconexão. O servidor SHALL descartar peers cujo envio falhar.

#### Scenario: Conexão zumbi é detectada pelo cliente
- **WHEN** nenhuma mensagem (incluindo heartbeats) chega dentro de 2× o intervalo de heartbeat
- **THEN** o cliente considera a conexão morta, fecha o socket e reconecta

#### Scenario: Heartbeat não vira evento de domínio
- **WHEN** uma mensagem de heartbeat chega ao cliente
- **THEN** ela atualiza o controle de conexão sem tocar no estado de dados nem na UI

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

