## ADDED Requirements

### Requirement: Botões de ação com fundo preenchido

Todos os botões de ação da aplicação que atualmente possuem apenas borda colorida (outline) SHALL ser convertidos para botões preenchidos (`filled`). A paleta de cores SHALL seguir as variáveis do tema Tailwind existente:

- **Ação primária** (criar, salvar, confirmar): fundo `bg-primary` (azul), texto branco
- **Ação destrutiva** (excluir, cancelar operação): fundo `bg-destructive` / `bg-red-600`, texto branco
- **Ação secundária / neutra** (cancelar, fechar, voltar): fundo `bg-muted` / cinza, texto `text-foreground`
- **Ação de sucesso / confirmar**: fundo `bg-green-600`, texto branco
- **Ação de aviso**: fundo `bg-amber-500`, texto branco

Os botões SHALL manter hover state com variante mais escura da cor de fundo (ex: `hover:bg-primary/90`).

#### Scenario: Botão primário preenchido

- **WHEN** o usuário visualiza qualquer botão de ação principal (ex: "Salvar", "Criar", "Adicionar")
- **THEN** o botão exibe fundo azul sólido com texto branco, não apenas borda

#### Scenario: Botão destrutivo preenchido

- **WHEN** o usuário visualiza qualquer botão de exclusão ou ação destrutiva
- **THEN** o botão exibe fundo vermelho sólido com texto branco

#### Scenario: Hover escurece o botão

- **WHEN** o usuário passa o mouse sobre qualquer botão preenchido
- **THEN** o fundo fica levemente mais escuro (opacidade reduzida ou shade mais escuro)

---

### Requirement: Ícones Lucide em botões de ação

Todos os botões de ação SHALL incluir um ícone Lucide React alinhado à esquerda do texto. Os ícones SHALL ser representativos da ação:

| Ação | Ícone Lucide |
|------|-------------|
| Excluir / Deletar | `Trash2` |
| Editar | `Pencil` |
| Adicionar / Criar | `Plus` |
| Salvar / Confirmar | `Check` |
| Cancelar / Fechar | `X` |
| Novo Épico | `Layers` |
| Nova História | `BookOpen` |
| Nova Task | `CheckSquare` |
| Novo Bug | `Bug` |
| Mover / Arrastar | `GripVertical` (já existente) |
| Informação | `Info` |
| Filhos / Subtasks | `GitBranch` |

Os ícones SHALL ter tamanho `w-4 h-4` (16px) e margin-right de `mr-1.5` em relação ao texto do botão.

#### Scenario: Botão de criar exibe ícone Plus

- **WHEN** o usuário visualiza um botão de criação (ex: "+ Nova Task", "+ Adicionar subtask")
- **THEN** o ícone `Plus` do Lucide é exibido à esquerda do texto

#### Scenario: Botão excluir exibe ícone de lixeira

- **WHEN** o usuário visualiza o botão de exclusão no card ou modal
- **THEN** o ícone `Trash2` do Lucide é exibido

#### Scenario: Ícones não quebram layout do botão

- **WHEN** ícone e texto são exibidos juntos no botão
- **THEN** ambos ficam alinhados verticalmente ao centro, sem overflow
