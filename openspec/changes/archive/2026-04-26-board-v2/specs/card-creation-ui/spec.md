## MODIFIED Requirements

### Requirement: Seletor de tipo no formulário rápido de criação

**MODIFIED** — Adicionar campo tipo ao `AddCardForm`.

#### Scenario: Criar card com tipo Task ou Bug
- **WHEN** o formulário rápido "+" está aberto
- **THEN** além do campo título, exibe um seletor de tipo com opções `Task` (padrão) e `Bug`
- **AND** ao confirmar, o `type` selecionado é enviado para `POST /projects/:id/tasks`
