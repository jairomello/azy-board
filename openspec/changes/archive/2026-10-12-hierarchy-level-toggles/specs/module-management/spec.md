# Spec Delta

## ADDED Requirements

### Requirement: Módulos ocultos operam com módulo único

Com a opção de ocultar módulos ligada, o projeto SHALL operar com um único módulo
interno: os controles de gestão de módulos (criar, renomear, excluir, reordenar)
e o filtro de módulos SHALL deixar de ser exibidos, e a criação de épicos SHALL
vincular-se automaticamente ao módulo único.

#### Scenario: Seção de módulos indisponível

- **WHEN** o projeto tem módulos ocultos e o ADMIN acessa Configurações
- **THEN** a seção/controles de módulos não são exibidos

#### Scenario: Filtro de módulos ausente no board

- **WHEN** o projeto tem módulos ocultos
- **THEN** o board não oferece filtro por módulo

#### Scenario: Criação automática de épico vincula ao módulo único

- **WHEN** um épico é criado em projeto com módulos ocultos
- **THEN** o sistema vincula o épico ao módulo único sem exigir escolha de módulo
