## ADDED Requirements

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
