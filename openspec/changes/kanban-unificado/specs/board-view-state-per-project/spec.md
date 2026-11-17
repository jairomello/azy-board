# Spec Delta

## ADDED Requirements

### Requirement: Persistir o layout do Kanban por projeto
O sistema SHALL armazenar o layout do Kanban (`lanes` ou `unified`) junto das preferências
visuais do Board, separado por `projectId`, e SHALL restaurá-lo ao abrir o projeto. Na
ausência da preferência, o padrão SHALL ser `unified`. Valores desconhecidos SHALL cair no
padrão sem erro visível, e o armazenamento indisponível SHALL NOT impedir o uso do Board.

#### Scenario: Alteração de layout
- **WHEN** a pessoa alterna entre `Por épico` e `Unificado`
- **THEN** o layout é gravado para o projeto atual e restaurado na próxima abertura

#### Scenario: Projetos independentes
- **WHEN** dois projetos têm layouts diferentes
- **THEN** cada um restaura o próprio layout

#### Scenario: Preferência ausente ou inválida
- **WHEN** a preferência gravada não tem layout ou tem um valor desconhecido
- **THEN** o Board abre no layout unificado, sem erro

#### Scenario: Comando da conversa aplica filtros
- **WHEN** o assistente aplica ou limpa filtros pela conversa
- **THEN** o layout escolhido pela pessoa é preservado

#### Scenario: Armazenamento indisponível
- **WHEN** ler ou gravar o estado do Board lança erro
- **THEN** o Board continua funcional no layout unificado
