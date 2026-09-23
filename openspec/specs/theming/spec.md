## Purpose

Definir temas claro e escuro, presets estruturais claros e a persistência das preferências visuais.

## Requirements

### Requirement: Toggle de tema claro/escuro
O sistema SHALL oferecer toggle de tema claro e escuro acessível em toda a aplicação. Todos os componentes de UI SHALL suportar ambos os modos sem exceção.

#### Scenario: Ativar tema escuro
- **WHEN** usuário clica no toggle de tema
- **THEN** sistema aplica a classe `dark` no elemento raiz `<html>` e todos os componentes mudam para o esquema de cores escuro imediatamente

#### Scenario: Preferência persistida em localStorage
- **WHEN** usuário altera o tema
- **THEN** preferência é salva em `localStorage` e aplicada automaticamente na próxima abertura da aplicação, antes do primeiro render (sem flash de tema errado)

#### Scenario: Preferência sincronizada com o banco
- **WHEN** usuário autenticado altera o tema
- **THEN** preferência é salva no campo `theme` do usuário no banco para sincronizar entre dispositivos

#### Scenario: Preferência do SO usada como ponto de partida na primeira visita
- **WHEN** usuário acessa a aplicação pela primeira vez sem preferência salva no `localStorage`
- **THEN** sistema detecta a preferência do SO via `prefers-color-scheme`, aplica o tema correspondente E o persiste imediatamente em `localStorage`
- **AND** mudanças posteriores na preferência do SO não afetam o tema da aplicação

#### Scenario: Tema não muda com alteração da preferência do SO
- **WHEN** o usuário já possui uma entrada salva em `localStorage['theme']`
- **AND** a preferência do sistema operacional muda (ex.: agendamento automático)
- **THEN** o tema da aplicação permanece inalterado
- **AND** o tema só muda quando o usuário clicar explicitamente no toggle

### Requirement: Temas estruturais do modo claro
O sistema SHALL permitir que o usuário escolha um preset de cor para sidebar e header no modo claro, independentemente da preferência claro/escuro.

Os presets suportados SHALL ser `petroleum`, `ocean`, `emerald`, `graphite` e `classic`, com `petroleum` como fallback e valor padrão.

#### Scenario: Selecionar tema Petróleo
- **WHEN** o usuário seleciona Petróleo nas preferências de aparência
- **THEN** sidebar e header recebem os tokens do preset `petroleum` imediatamente
- **AND** o conteúdo do Board permanece no esquema claro

#### Scenario: Selecionar outro preset claro
- **WHEN** o usuário seleciona Oceano, Esmeralda, Grafite ou Clássico
- **THEN** o shell é atualizado sem reload
- **AND** textos, ícones, foco e item ativo mantêm contraste WCAG AA

#### Scenario: Alternar para modo escuro e retornar
- **WHEN** o usuário possui um preset claro selecionado, alterna para o modo escuro e depois retorna ao claro
- **THEN** o modo escuro ignora os tokens do preset claro
- **AND** o preset claro anteriormente escolhido é restaurado

#### Scenario: Valor inválido ou desconhecido
- **WHEN** o valor vindo do banco ou `localStorage` não corresponde a um preset suportado
- **THEN** o sistema aplica `petroleum`
- **AND** não interrompe a renderização da aplicação

### Requirement: Persistência do tema estrutural claro
O sistema SHALL persistir o preset claro no `localStorage` e no usuário autenticado para sincronização entre dispositivos.

#### Scenario: Persistência local antes do render
- **WHEN** a aplicação inicia e existe `localStorage['light-shell-theme']`
- **THEN** o sistema aplica `data-light-shell-theme` no `<html>` antes do primeiro render do React
- **AND** não exibe flash com outro preset

#### Scenario: Persistência no banco
- **WHEN** um usuário autenticado altera o preset claro
- **THEN** o sistema salva `lightShellTheme` por `PATCH /api/users/me`
- **AND** a resposta atualiza o estado do usuário no frontend

#### Scenario: Sincronização após login
- **WHEN** o usuário entra em outro dispositivo
- **THEN** o preset retornado pelo servidor substitui o bootstrap local
- **AND** passa a ser o valor salvo no `localStorage`

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
