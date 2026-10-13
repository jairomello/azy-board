# Spec Delta

## ADDED Requirements

### Requirement: Tree View pula níveis ocultados

A Tree View SHALL respeitar as opções de ocultar módulos e épicos: com módulos
ocultos, a raiz exibe os épicos; com épicos ocultos, as histórias aparecem sob o
módulo ou na raiz; com ambos ocultos, a raiz exibe as histórias. O conteúdo e a
navegação das linhas SHALL ser preservados.

#### Scenario: Árvore sem módulos

- **WHEN** o projeto tem módulos ocultos
- **THEN** a árvore não exibe nós de módulo e lista os épicos no nível raiz

#### Scenario: Árvore sem épicos

- **WHEN** o projeto tem épicos ocultos
- **THEN** a árvore não exibe nós de épico e lista as histórias sob o módulo (ou na raiz, se módulos também ocultos)

#### Scenario: Árvore sem módulos nem épicos

- **WHEN** as duas opções estão ligadas
- **THEN** a árvore lista as histórias na raiz, com suas tasks e subtasks
