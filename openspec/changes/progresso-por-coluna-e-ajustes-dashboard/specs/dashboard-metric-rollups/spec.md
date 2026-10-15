# Spec Delta

## ADDED Requirements

### Requirement: Código sequencial no detalhe de itens do dashboard

As listas de detalhe dos quadros do dashboard SHALL expor o código sequencial do item (`sequenceCode`) quando existir, de forma aditiva, mantendo os campos atuais. O código SHALL ser usado para rotular itens nos rankings e no detalhe, e SHALL NOT substituir o identificador técnico onde ele é necessário.

#### Scenario: Detalhe do aging traz o código

- **WHEN** o endpoint de aging devolve itens em WIP
- **THEN** cada item inclui `sequenceCode` além dos campos já existentes

#### Scenario: Detalhe de bloqueados traz o código

- **WHEN** o endpoint de snapshot devolve os itens bloqueados
- **THEN** cada item inclui `sequenceCode` quando o card tem código

#### Scenario: Item sem código não quebra a resposta

- **WHEN** um item não possui código sequencial
- **THEN** o campo vem nulo e o rótulo usa o título, sem erro

#### Scenario: Compatibilidade preservada

- **WHEN** um cliente antigo consome a resposta
- **THEN** os campos e estruturas anteriores continuam presentes com o mesmo significado
