# Spec Delta

## ADDED Requirements

### Requirement: Nome do projeto no header abre a modal de planejamento

O nome do projeto exibido no header do board SHALL ser um controle interativo
acessível por mouse e teclado. Ao ser acionado, SHALL abrir a modal de
Planejamento do Projeto do projeto atual, sem navegar para outra rota.

#### Scenario: Acionar o nome do projeto

- **WHEN** o usuário clica no nome do projeto no header do board
- **THEN** a modal de Planejamento do Projeto abre para o projeto atual

#### Scenario: Acionar por teclado

- **WHEN** o controle do nome do projeto recebe foco e o usuário o ativa por teclado
- **THEN** a modal de Planejamento do Projeto abre para o projeto atual, com foco visível

#### Scenario: Nome indisponível

- **WHEN** o nome do projeto não está disponível no header
- **THEN** nenhum controle de abertura é exibido, mantendo o comportamento atual de fallback
