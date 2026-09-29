## ADDED Requirements

### Requirement: Eventos ordenados e replay por cursor
O sistema SHALL numerar os eventos WebSocket com uma `sequence` monotônica por projeto e SHALL manter um buffer limitado dos eventos recentes do projeto. Ao (re)conectar, o cliente SHALL informar o último cursor recebido e o servidor SHALL reenviar os eventos posteriores a esse cursor; quando o replay não for possível (cursor fora do buffer, servidor reiniciado ou gap incoerente), o servidor SHALL enviar uma ordem explícita de ressincronização e o cliente SHALL refazer as consultas ativas do projeto. Nenhuma dessas operações SHALL ser apresentada ao usuário como erro.

#### Scenario: Queda curta é coberta por replay
- **WHEN** o cliente reconecta informando cursor e os eventos perdidos ainda estão no buffer do servidor
- **THEN** o servidor reenvia apenas os eventos após o cursor e o cliente os aplica em ordem

#### Scenario: Queda longa dispara ressincronização
- **WHEN** o cliente reconecta com cursor fora do buffer do servidor
- **THEN** o servidor envia a ordem de ressincronização e o cliente refaz as consultas ativas do projeto

#### Scenario: Servidor reiniciado ressincroniza
- **WHEN** o cliente reconecta com cursor maior que a sequência atual do servidor
- **THEN** o cliente ressincroniza por refetch em vez de aplicar eventos fora de ordem

#### Scenario: Aplicação idempotente de replay
- **WHEN** um evento já aplicado volta a chegar por replay
- **THEN** o estado do cliente não diverge (a aplicação é idempotente)

### Requirement: Heartbeat e detecção de conexão zumbi
O sistema SHALL manter heartbeat de aplicação entre servidor e cliente e SHALL tratar conexão sem tráfego dentro do intervalo de tolerância como queda, disparando a reconexão. O servidor SHALL descartar peers cujo envio falhar.

#### Scenario: Conexão zumbi é detectada pelo cliente
- **WHEN** nenhuma mensagem (incluindo heartbeats) chega dentro de 2× o intervalo de heartbeat
- **THEN** o cliente considera a conexão morta, fecha o socket e reconecta

#### Scenario: Heartbeat não vira evento de domínio
- **WHEN** uma mensagem de heartbeat chega ao cliente
- **THEN** ela atualiza o controle de conexão sem tocar no estado de dados nem na UI

### Requirement: Estado de sincronização honesto na UI
O web SHALL distinguir visualmente "conectado" de "dados reconciliados": o estado SHALL transitar por `connecting → syncing → synced` (ou `offline`), e "Sincronizado" SHALL ser exibido somente após a reconciliação (replay aplicado ou refetch concluído). Enquanto a reconciliação estiver em andamento, a UI SHALL indicar que está sincronizando.

#### Scenario: Conectar não é o mesmo que estar sincronizado
- **WHEN** a conexão WebSocket é aberta mas o replay/refetch ainda não concluiu
- **THEN** a UI exibe o estado de sincronização em andamento, não "Sincronizado"

#### Scenario: Sincronizado só após reconciliação
- **WHEN** o replay é aplicado ou o refetch de ressincronização conclui
- **THEN** a UI passa a exibir "Sincronizado"

#### Scenario: Queda mostra estado offline sem alarme de erro
- **WHEN** a conexão cai e a reconexão automática entra em andamento
- **THEN** a UI reflete offline/conectando sem tratar a situação como falha de aplicação

## MODIFIED Requirements

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
