## MODIFIED Requirements

### Requirement: Botão ícone com tooltip na toolbar
O sistema SHALL exibir botões de ação e toggle da toolbar do board como ícones sem label de texto, acompanhados de um tooltip descritivo que aparece após 500ms de hover. O estado ativo/inativo de cada toggle SHALL ser persistido no `localStorage` e restaurado entre sessões.

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
- **THEN** os toggles "Mostrar subtasks" e "Histórias no board" são restaurados para o último estado salvo no `localStorage`

#### Scenario: Toggle "Histórias no board" ativo por padrão em board novo
- **WHEN** o usuário abre o board de um projeto pela primeira vez (sem estado persistido)
- **THEN** o toggle "Histórias no board" inicia no estado ativo (ligado)
- **AND** o toggle "Mostrar subtasks" inicia no estado inativo (desligado)

### Requirement: Zonas visuais da toolbar com separadores
O sistema SHALL organizar os controles da toolbar em três zonas separadas por divisores verticais:
1. **Visualização**: toggles de Mostrar subtasks, Histórias no board, Expandir tudo, Recolher tudo
2. **Filtros**: dropdowns (Squad, Módulo, Responsável) e pills de tipo (Tarefa, Bug)
3. **Ações de conteúdo**: Ocultar épicos vazios, Arquivados

#### Scenario: Separadores visíveis entre zonas
- **WHEN** a toolbar é renderizada
- **THEN** divisores verticais (`w-px h-5 bg-border`) separam visualmente as três zonas
