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
