# Spec Delta

## ADDED Requirements

### Requirement: Persistência do filtro de última alteração

O sistema SHALL persistir o valor selecionado na dimensão "Alterados" junto do estado de filtros em `board-filters:<projectId>` e SHALL restaurá-lo na próxima visita ao Board do mesmo projeto.

#### Scenario: Valor persistido ao selecionar

- **WHEN** o usuário seleciona uma janela de alteração
- **THEN** o valor é gravado em `board-filters:<projectId>` e restaurado ao reabrir o projeto

#### Scenario: Remoção pelo chip individual

- **WHEN** o usuário remove o chip do filtro de alteração
- **THEN** somente esse valor volta ao estado neutro e a nova configuração é persistida

#### Scenario: Estado antigo sem o novo filtro

- **WHEN** o valor persistido não contém a dimensão de alteração
- **THEN** o sistema usa o estado neutro para esse campo e preserva os demais filtros e opções

#### Scenario: Independência por projeto

- **WHEN** o usuário alterna entre projetos com janelas de alteração diferentes
- **THEN** cada projeto restaura seu próprio valor sem interferência
