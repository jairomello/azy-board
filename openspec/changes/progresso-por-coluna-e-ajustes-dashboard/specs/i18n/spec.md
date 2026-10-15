# Spec Delta

## ADDED Requirements

### Requirement: Auditoria de texto de produto nos módulos de adaptação

A auditoria de internacionalização SHALL cobrir também os módulos de adaptação e utilitários do web (arquivos `.ts` que produzem rótulos, unidades e séries exibidas), e SHALL NOT se limitar aos componentes. Textos de produto nesses módulos SHALL vir dos recursos de tradução, e a auditoria SHALL reportar literais exibidos que não estejam excecionados.

#### Scenario: Literal de rótulo em módulo de adaptação reprova

- **WHEN** um módulo de adaptação define um rótulo exibido em um gráfico sem passar pela tradução
- **THEN** a auditoria reporta o arquivo e o literal

#### Scenario: Rótulo traduzido passa

- **WHEN** o rótulo exibido vem de uma chave de tradução presente nos três idiomas
- **THEN** a auditoria conclui com sucesso

#### Scenario: Conteúdo e identificadores não são reportados

- **WHEN** o módulo usa identificadores técnicos, nomes próprios ou dados do usuário
- **THEN** eles não são reportados como texto de produto
