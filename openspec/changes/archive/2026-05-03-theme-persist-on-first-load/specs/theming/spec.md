## MODIFIED Requirements

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
