# Spec Delta

## MODIFIED Requirements

### Requirement: Modal de edição de card organizada em accordions

O sistema SHALL apresentar campos do card, descrição, subtasks, checklists e Histórico em áreas independentes, preservando edição, criação, abertura de filhos e salvamento. A área Histórico SHALL exibir dois painéis independentes: Auditoria de alterações (eventos automáticos) e Diário de trabalho (registros manuais, com total de duração e formulário inline). A modal SHALL manter título, descrição rich text (Tiptap), prioridade, responsável, **responsável externo**, story pai, tags, pontos, datas de início e fim, **datas realizadas e baseline** e a **chave externa em modo somente leitura quando existir**. A descrição SHALL ter um rascunho local persistido automaticamente e preservado quando a modal é fechada sem salvar, sendo removido após salvamento confirmado.

#### Scenario: Seções independentes
- **WHEN** usuário abre a área Histórico de uma Task, Bug ou Subtask
- **THEN** Auditoria de alterações e Diário de trabalho aparecem simultaneamente em painéis distintos, sem misturar logs, horas ou ações

#### Scenario: Estado inicial com listas vazias
- **WHEN** card não possui eventos automáticos nem registros manuais
- **THEN** a área Histórico mostra estados vazios explicativos nos dois painéis e uma ação visível para registrar trabalho, sem abrir outra modal

#### Scenario: Contagens e totalização
- **WHEN** card possui eventos automáticos ou registros manuais
- **THEN** cada painel mostra somente sua própria contagem, e o Diário mostra o total de duração sem incluir auditoria automática

#### Scenario: Salvar edições pela modal
- **WHEN** usuário altera campos e clica em Salvar
- **THEN** todas as alterações são enviadas via API e o card no board atualiza em tempo real

#### Scenario: Datas de acompanhamento na modal
- **WHEN** usuário abre as propriedades de planejamento de um card que tem datas realizadas e baseline
- **THEN** as datas previstas, realizadas e baseline aparecem em campos separados e podem ser editadas e salvas

#### Scenario: Responsável externo na modal
- **WHEN** usuário digita um responsável externo e salva
- **THEN** o texto é persistido em `assigneeLabel` e aparece no card quando não há usuário responsável

#### Scenario: Chave externa somente leitura
- **WHEN** o card tem `externalSource` e `externalRef`
- **THEN** a modal exibe a chave como informação somente leitura, sem permitir alteração pelo usuário comum
