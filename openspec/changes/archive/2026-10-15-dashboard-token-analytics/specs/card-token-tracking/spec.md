# Spec Delta

## ADDED Requirements

### Requirement: Alteração de tokens alimenta o histórico de analytics

O sistema SHALL registrar a alteração de tokens como evento de analytics do item e SHALL
atualizar o acervo agregado na MESMA transação da mutação, para permitir série histórica
no Dashboard. O snapshot de analytics do item SHALL incluir `tokensInput` e
`tokensOutput`. Criar, alterar e limpar tokens SHALL ser refletidos no histórico: a
criação usa o evento de criação do item e a edição emite o evento de alteração de
tokens; a operação em lote SHALL aplicar o comportamento por item.

#### Scenario: Edição individual altera tokens

- **WHEN** um card tem `tokensInput` ou `tokensOutput` alterado por edição (inclusive limpeza)
- **THEN** um evento de alteração de tokens é registrado e o acervo do dia passa a refletir os novos valores

#### Scenario: Criação com tokens

- **WHEN** um card é criado já com tokens informados
- **THEN** a criação registra os valores no snapshot do evento de criação e o acervo passa a contá-los

#### Scenario: Limpeza de tokens

- **WHEN** os tokens de um card são limpos
- **THEN** o evento registra a saída dos valores e o acervo deixa de contá-los a partir da data da limpeza

#### Scenario: Lote de tokens

- **WHEN** um lote informa tokens para vários cards
- **THEN** cada card aplicado gera seu próprio registro, e entradas rejeitadas não geram evento

#### Scenario: Isolamento do histórico

- **WHEN** uma escrita de tokens é rejeitada por tenant, projeto ou permissão
- **THEN** nenhum evento de analytics é gravado para o item rejeitado
