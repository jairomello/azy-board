# Spec Delta

## MODIFIED Requirements

### Requirement: Colunas de dados na Tree View
O sistema SHALL exibir as seguintes colunas para cada item: Nome (com ícone de tipo), Status, Responsável, Data de Início, Data de Fim, Pontos, Progresso (%) e Dependências. A coluna Progresso SHALL exibir uma barra visual e o percentual numérico calculado para folhas e items agrupadores. A coluna Dependências SHALL listar os itens dos quais a linha depende, identificados pelo `sequenceCode` (com fallback para o título quando ausente), exibidos como referências legíveis.

#### Scenario: Progresso de items pai na Tree View
- **WHEN** item pai (EPIC, STORY ou TASK/BUG com filhos) é exibido na Tree View
- **THEN** coluna Progresso exibe porcentagem acumulada calculada pelas folhas TASK/BUG descendentes com barra visual

#### Scenario: Progresso de item folha
- **WHEN** item folha TASK ou BUG é exibido na Tree View
- **THEN** coluna Progresso exibe 100% se o status for DONE e 0% caso contrário

#### Scenario: Status de items folha
- **WHEN** item folha TASK ou BUG é exibido na Tree View
- **THEN** coluna Status exibe o status base atual com indicador visual colorido

#### Scenario: Pontos na Tree View
- **WHEN** item é exibido na Tree View
- **THEN** coluna Pontos exibe o valor da task folha ou a soma calculada para items pai

#### Scenario: Coluna de dependências exibe itens dependidos
- **WHEN** um item com dependências cadastradas é exibido na Tree View
- **THEN** a coluna Dependências lista cada item dependido, priorizando o `sequenceCode` e usando o título quando o código não existir

#### Scenario: Item sem dependências
- **WHEN** um item sem dependências é exibido na Tree View
- **THEN** a célula da coluna Dependências fica vazia, sem indicar dependência inexistente

#### Scenario: Respeitar filtros na coluna de dependências
- **WHEN** a Tree View é filtrada por módulo, sprint, responsável ou tag
- **THEN** a coluna Dependências continua refletindo as dependências cadastradas dos itens exibidos
