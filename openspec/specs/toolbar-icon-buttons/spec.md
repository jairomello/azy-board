## ADDED Requirements

### Requirement: Botão ícone com tooltip na toolbar
O sistema SHALL exibir botões de ação e toggle da toolbar do board como ícones sem label de texto, acompanhados de um tooltip descritivo que aparece após 500ms de hover.

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

### Requirement: Zonas visuais da toolbar com separadores
O sistema SHALL organizar os controles da toolbar em três zonas separadas por divisores verticais:
1. **Visualização**: toggles de Mostrar subtasks, Histórias no board, Expandir tudo, Recolher tudo
2. **Filtros**: dropdowns (Squad, Módulo, Responsável) e pills de tipo (Tarefa, Bug)
3. **Ações de conteúdo**: Ocultar épicos vazios, Arquivados

#### Scenario: Separadores visíveis entre zonas
- **WHEN** a toolbar é renderizada
- **THEN** divisores verticais (`w-px h-5 bg-border`) separam visualmente as três zonas
