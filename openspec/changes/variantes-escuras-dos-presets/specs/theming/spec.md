# Spec Delta

## ADDED Requirements

### Requirement: Variantes escuras por preset de shell
Cada preset suportado SHALL definir uma variante escura completa de tokens globais, do shell e do Board, aplicada quando o tema efetivo for escuro. O preset selecionado SHALL governar shell e Board nos dois modos, sem preferência separada, e `petroleum` SHALL permanecer como padrão e fallback.

#### Scenario: Preset escolhido vale nos dois modos
- **WHEN** o usuário seleciona um preset com o tema escuro ativo
- **THEN** sidebar, cabeçalho, canvas, colunas e cards assumem a variante escura desse preset
- **AND** ao retornar ao tema claro, os tokens claros do mesmo preset são aplicados

#### Scenario: Dez variantes escuras distintas
- **WHEN** o usuário percorre os dez presets com o tema escuro ativo
- **THEN** cada preset aplica uma paleta escura própria e distinguível das demais
- **AND** nenhum preset cai na paleta azulada fixa usada antes desta mudança

#### Scenario: Padrão e fallback
- **WHEN** não há preset salvo ou o valor recebido não é um preset suportado
- **THEN** o sistema aplica `petroleum` nos dois modos sem interromper a renderização

#### Scenario: Troca sem reload
- **WHEN** o usuário troca o preset estando no modo escuro
- **THEN** shell e Board refletem a nova variante escura imediatamente, sem recarregar a página

### Requirement: Cores semânticas estáveis nas variantes escuras
As cores de status e das séries do Dashboard SHALL preservar seu significado em todas as variantes escuras — andamento em azul, revisão em violeta, concluído em verde e bloqueado em vermelho — ajustando apenas luminosidade e saturação ao fundo. Nenhuma variante SHALL trocar o matiz semântico por decoração do preset.

#### Scenario: Status distinguíveis em qualquer variante escura
- **WHEN** o Board é exibido no modo escuro com qualquer preset
- **THEN** as colunas e os indicadores de status mantêm o mesmo significado de cor
- **AND** permanecem distinguíveis entre si e legíveis sobre as superfícies escuras

#### Scenario: Séries do Dashboard preservadas
- **WHEN** o Dashboard é exibido no modo escuro com qualquer preset
- **THEN** as séries mantêm os matizes semânticos atuais e apenas se ajustam ao fundo

### Requirement: Seletor de Aparência coerente com os dois modos
O seletor de presets SHALL apresentar cada preset como escolha de aparência dos dois modos, com rótulo que não o restrinja ao modo claro e amostra que reflita o modo efetivo ativo.

#### Scenario: Rótulo sem restrição ao modo claro
- **WHEN** o usuário abre as preferências de Aparência em qualquer idioma suportado
- **THEN** o seletor de presets não se apresenta como exclusivo do shell claro

#### Scenario: Amostra acompanha o modo efetivo
- **WHEN** o tema efetivo é escuro
- **THEN** as amostras dos presets exibem a variante escura correspondente
- **WHEN** o tema efetivo é claro
- **THEN** as amostras exibem a variante clara correspondente

#### Scenario: Navegação por teclado preservada
- **WHEN** o usuário navega pela grade de presets com as setas
- **THEN** a seleção muda de preset, a escolha é persistida e o anel de foco continua visível nos dois modos

## MODIFIED Requirements

### Requirement: Temas estruturais do modo claro
O sistema SHALL permitir que o usuário escolha um preset de cor para sidebar e header no modo claro, independentemente da preferência claro/escuro.

Os presets suportados SHALL ser `petroleum`, `ocean`, `emerald`, `graphite`, `classic`, `ruby`, `amber`, `amethyst`, `rose` e `silver`, com `petroleum` como fallback e valor padrão.

A grade de seleção de presets SHALL exibir os dez presets com rótulo traduzido e amostra de cor coerente. Cada preset SHALL definir sidebar, header, borda, texto, item ativo, acento e texto sobre acento para o modo claro, mantendo contraste legível nos controles do shell.

#### Scenario: Selecionar tema Petróleo
- **WHEN** o usuário seleciona Petróleo nas preferências de aparência
- **THEN** sidebar e header recebem os tokens do preset `petroleum` imediatamente
- **AND** o conteúdo do Board permanece no esquema claro

#### Scenario: Selecionar outro preset claro
- **WHEN** o usuário seleciona Oceano, Esmeralda, Grafite ou Clássico
- **THEN** o shell é atualizado sem reload
- **AND** textos, ícones, foco e item ativo mantêm contraste WCAG AA

#### Scenario: Selecionar um dos novos presets
- **WHEN** o usuário seleciona Vermelho, Laranja, Roxo, Rosa ou Prata
- **THEN** o shell é atualizado sem reload para os tokens do preset escolhido
- **AND** o preset permanece legível e distinguível dos demais na grade

#### Scenario: Alternar para modo escuro e retornar
- **WHEN** o usuário possui um preset selecionado, alterna para o modo escuro e depois retorna ao claro
- **THEN** o modo escuro aplica a variante escura do mesmo preset
- **AND** ao retornar ao claro, os tokens claros do preset são restaurados sem reload

#### Scenario: Valor inválido ou desconhecido
- **WHEN** o valor vindo do banco ou `localStorage` não corresponde a um preset suportado
- **THEN** o sistema aplica `petroleum`
- **AND** não interrompe a renderização da aplicação

### Requirement: Persistência do tema estrutural claro
O sistema SHALL persistir o preset escolhido no `localStorage` e no usuário autenticado para sincronização entre dispositivos. O mesmo valor SHALL governar as variantes clara e escura; nenhum campo adicional de preferência é criado.

#### Scenario: Persistência local antes do render
- **WHEN** a aplicação inicia e existe `localStorage['light-shell-theme']`
- **THEN** o sistema aplica `data-light-shell-theme` no `<html>` antes do primeiro render do React
- **AND** não exibe flash com outro preset no modo claro nem no escuro

#### Scenario: Persistência no banco
- **WHEN** um usuário autenticado altera o preset
- **THEN** o sistema salva `lightShellTheme` por `PATCH /api/users/me`
- **AND** a resposta atualiza o estado do usuário no frontend

#### Scenario: Sincronização após login
- **WHEN** o usuário entra em outro dispositivo
- **THEN** o preset retornado pelo servidor substitui o bootstrap local
- **AND** passa a ser o valor salvo no `localStorage`

#### Scenario: Um único campo para os dois modos
- **WHEN** o usuário alterna entre claro e escuro mantendo o mesmo preset
- **THEN** nenhuma preferência adicional é gravada no `localStorage` nem no banco
