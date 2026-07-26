## Purpose

Definir a apresentação acessível e a organização dos controles compactos da command bar e do painel de filtros.

## Requirements

### Requirement: Botão ícone com tooltip na toolbar
O sistema SHALL exibir controles compactos de visualização como ícones acompanhados de tooltip descritivo. Controles cujo objeto precisa permanecer explícito, como ocultação de épicos ou histórias vazias, MAY combinar ícone e label curta. O estado ativo/inativo dos toggles SHALL ser persistido no `localStorage` e restaurado entre sessões.

#### Scenario: Tooltip aparece ao manter hover
- **WHEN** o usuário posiciona o cursor sobre um botão ícone da toolbar por 500ms ou mais
- **THEN** um tooltip com o nome da ação é exibido abaixo do botão

#### Scenario: Tooltip desaparece ao mover o cursor
- **WHEN** o usuário move o cursor para fora do botão ícone
- **THEN** o tooltip é ocultado imediatamente

#### Scenario: Estado ativo visualmente distinguível
- **WHEN** um toggle de ícone está ativo (ex.: "Mostrar subtasks" ligado)
- **THEN** o botão exibe fundo `bg-primary/10`, borda `border-primary/30` e cor de ícone `text-primary`

#### Scenario: Estado inativo
- **WHEN** um toggle de ícone está inativo
- **THEN** o botão exibe ícone em `text-muted-foreground` e muda para `text-foreground` no hover

#### Scenario: Estado dos toggles restaurado ao abrir o board
- **WHEN** o usuário navega para o board de um projeto
- **THEN** `showSubtasks`, `storyDisplay`, `hideEmptyEpics` e `hideEmptyStories` são restaurados do último estado salvo

#### Scenario: Histórias como lanes por padrão em board novo
- **WHEN** o usuário abre o board de um projeto pela primeira vez (sem estado persistido)
- **THEN** `storyDisplay` inicia como `lanes`
- **AND** o toggle "Mostrar subtasks" inicia no estado inativo (desligado)

### Requirement: Organização dos controles na command bar
O sistema SHALL manter na command bar os comandos principais e agrupar filtros e controles secundários em um painel acessível pela ação **Filtros**.

#### Scenario: Abrir filtros e visualização
- **WHEN** o usuário aciona **Filtros**
- **THEN** o painel apresenta a zona **Exibição**, filtros por valores, tipos, tags e ação Limpar

#### Scenario: Alternar o modo de histórias
- **WHEN** `storyDisplay = lanes`
- **THEN** o tooltip do controle oferece "Exibir histórias como cards"

#### Scenario: Retornar ao modo de lanes
- **WHEN** `storyDisplay = cards`
- **THEN** o tooltip oferece "Exibir histórias como lanes"
