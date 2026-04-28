## ADDED Requirements

### Requirement: Box informativa sobre bloqueio na modal de item pai

A modal de edição de um item (TASK ou BUG) que possua subtasks (filhos) SHALL exibir uma caixa informativa (info box) explicando que o card está bloqueado para arrastar no Kanban porque seu status é derivado do progresso das suas subtasks — a posição de coluna do card pai é determinada pelos filhos, e não pode ser alterada manualmente.

O texto da box SHALL ser:
> "Este card tem subtasks. Seu status no board é determinado pelo progresso dos seus filhos — por isso ele não pode ser arrastado manualmente. Para mover este card, mova ou conclua as subtasks."

A box SHALL usar estilo visual de informação (fundo azul claro / ícone `Info` do Lucide React) e estar posicionada de forma destacada na modal, logo abaixo do cabeçalho.

#### Scenario: Modal aberta para item com filhos

- **WHEN** o usuário abre a modal de um item cujo `isLeaf` é `false` (possui subtasks)
- **THEN** a info box é exibida com o texto e ícone de informação

#### Scenario: Modal aberta para item sem filhos

- **WHEN** o usuário abre a modal de um item cujo `isLeaf` é `true`
- **THEN** a info box NÃO é exibida

#### Scenario: Info box não interfere com outras edições

- **WHEN** a info box está visível na modal
- **THEN** todos os outros campos de edição (título, status, prioridade, responsável, descrição, checklist) permanecem funcionais e editáveis
