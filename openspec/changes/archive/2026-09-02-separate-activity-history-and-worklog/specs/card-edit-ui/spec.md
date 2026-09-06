## MODIFIED Requirements

### Requirement: Modal de edição de card organizada em accordions
O sistema SHALL apresentar campos do card, descrição, subtasks, checklists, Histórico de alterações e Diário de trabalho em accordions independentes, preservando edição, criação, abertura de filhos e salvamento.

#### Scenario: Seções independentes
- **WHEN** usuário abre a modal de Task, Bug ou Subtask
- **THEN** Histórico de alterações e Diário de trabalho aparecem como seções distintas, cada uma com conteúdo, contagem e ação próprios

#### Scenario: Estado inicial
- **WHEN** modal é aberta
- **THEN** primeira seção permanece aberta e as demais fechadas conforme o padrão atual

#### Scenario: Contagens dos accordions
- **WHEN** card possui eventos automáticos ou registros manuais
- **THEN** cada accordion mostra somente sua própria contagem no resumo, sem usar `Sem conteúdo adicional` quando houver dados

### Requirement: Ações de histórico e diário não se misturam
O sistema SHALL manter a ação de abrir auditoria separada da ação de registrar trabalho.

#### Scenario: Abrir auditoria
- **WHEN** usuário aciona Histórico de alterações
- **THEN** sub-modal de auditoria é aberta e não apresenta campos de horas ou formulário de diário

#### Scenario: Registrar trabalho
- **WHEN** usuário aciona Registrar trabalho no Diário
- **THEN** formulário solicita descrição e duração `H:MM`, com autor somente leitura/preenchido pelo contexto

### Requirement: Formatação de conteúdo
O sistema SHALL renderizar descrições de auditoria e diário de forma legível, preservando texto e quebras relevantes sem exibir tags HTML cruas.

#### Scenario: Descrição rich text no histórico
- **WHEN** evento contém diferença originada no editor rich text
- **THEN** UI mostra texto normalizado ou diff seguro, sem literalizar ou executar tags HTML
