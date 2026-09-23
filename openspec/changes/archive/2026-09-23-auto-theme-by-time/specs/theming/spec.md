## ADDED Requirements

### Requirement: Tema automático por horário

O sistema SHALL oferecer, nas preferências do usuário, um controle "Tema automático por horário", desligado por padrão. Quando desligado, o tema efetivo SHALL ser o tema manual salvo; quando ligado, o sistema SHALL determinar o tema efetivo pela hora local do computador, usando o tema claro durante o dia e o escuro à noite. As faixas padrão SHALL ser dia de `06:00` a `17:59:59` e noite de `18:00` a `05:59:59`, definidas como constantes configuráveis. O modo automático SHALL NOT sobrescrever a preferência manual salva.

#### Scenario: Toggle desligado por padrão
- **WHEN** o usuário acessa as preferências sem nunca ter ativado o modo automático
- **THEN** o controle "Tema automático por horário" aparece desligado
- **AND** o tema aplicado é o tema manual salvo, sem consulta de horário

#### Scenario: Ativar o modo automático durante o dia
- **WHEN** o usuário liga o controle e a hora local está entre `06:00` e `17:59:59`
- **THEN** o sistema aplica o tema claro imediatamente, sem reload

#### Scenario: Ativar o modo automático durante a noite
- **WHEN** o usuário liga o controle e a hora local está entre `18:00` e `05:59:59`
- **THEN** o sistema aplica o tema escuro imediatamente, sem reload

#### Scenario: Acesso ao sistema com o modo automático ligado
- **WHEN** o usuário abre a aplicação com o modo automático já ativo
- **THEN** o tema correspondente à hora local é aplicado antes do primeiro render, sem flash de tema errado

#### Scenario: Preferência manual preservada
- **WHEN** o modo automático está ligado e o tema efetivo é calculado pelo horário
- **THEN** o valor de `localStorage['theme']` e o campo `theme` do usuário permanecem com a preferência manual anterior

#### Scenario: Desligar o modo automático
- **WHEN** o usuário desliga o controle
- **THEN** o sistema restaura imediatamente o tema manual salvo
- **AND** volta a não consultar o horário

#### Scenario: Sincronização entre dispositivos
- **WHEN** um usuário autenticado altera o controle
- **THEN** o sistema persiste a preferência por `PATCH /api/users/me` e o valor retorna no login e em `/api/auth/me`
- **AND** em outro dispositivo a preferência do servidor prevalece e é espelhada no `localStorage`

#### Scenario: Reavaliação na virada de faixa
- **WHEN** o modo automático está ligado e a hora local cruza o limite entre dia e noite com a aplicação aberta (por exemplo, `17:59` para `18:00`)
- **THEN** o sistema aplica o novo tema sem reload, reavaliando ao menos ao carregar, quando a aba volta a ficar visível/recebe foco e em intervalo periódico curto

#### Scenario: Seletor manual desabilitado enquanto o automático está ativo
- **WHEN** o modo automático está ligado
- **THEN** o seletor manual Claro/Escuro fica desabilitado com dica de que o horário está no comando
- **AND** o valor manual escolhido continua exibido para restauração posterior

#### Scenario: Valor ausente ou inválido
- **WHEN** a preferência não existe no `localStorage` nem no servidor, ou contém valor inesperado
- **THEN** o sistema trata o modo automático como desligado sem interromper a renderização
