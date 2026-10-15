# card-token-tracking Specification

## Purpose

Definir o registro, a validação, a exibição e o preenchimento massivo do consumo de
tokens de IA por card, para dar base histórica de estimativa de esforço de IA.

## Requirements

### Requirement: Campos de tokens no card

O item SHALL armazenar `tokensInput` e `tokensOutput` como inteiros não-negativos
opcionais. O total de tokens SHALL ser sempre derivado da soma dos dois campos e NÃO
SHALL ser persistido como valor independente. A ausência dos dois campos SHALL ser
tratada como "sem tokens registrados".

#### Scenario: Registrar entrada e saída

- **WHEN** um card recebe `tokensInput = 1200` e `tokensOutput = 300`
- **THEN** o sistema persiste os dois valores e apresenta o total `1500 tokens`

#### Scenario: Apenas um dos lados informado

- **WHEN** um card recebe somente `tokensOutput = 800` e nenhum `tokensInput`
- **THEN** o total apresentado é `800 tokens`, sem inventar valor para o lado ausente

#### Scenario: Valor negativo rejeitado

- **WHEN** uma chamada informa `tokensInput` ou `tokensOutput` negativo
- **THEN** o sistema rejeita a alteração com erro acionável e não persiste valor parcial

#### Scenario: Limpar tokens

- **WHEN** uma alteração usa a operação de limpeza sobre os campos de token
- **THEN** ambos passam a nulo e o card volta ao estado "sem tokens registrados"

### Requirement: Escrita de tokens com isolamento e permissão

O sistema SHALL aceitar tokens na criação e na edição de itens por REST e MCP, sempre
filtrando por tenant e projeto, com o mesmo nível de permissão da edição de pontos
(ADMIN/MEMBER escrevem; VIEWER apenas lê). Escrita fora do tenant ou do projeto SHALL
falhar sem revelar dados.

#### Scenario: Membro define tokens no próprio projeto

- **WHEN** membro com escrita edita tokens de um card do seu projeto
- **THEN** a API persiste os valores dentro do tenant e devolve o item atualizado

#### Scenario: Card fora do tenant ou projeto

- **WHEN** a chamada referencia um card de outro tenant ou de um projeto sem membership
- **THEN** a API responde 404 ou 403 conforme o recurso, sem alterar nada

#### Scenario: VIEWER tenta escrever

- **WHEN** usuário com papel VIEWER tenta editar tokens
- **THEN** a API responde 403 Forbidden e o valor permanece inalterado

### Requirement: Exibição de tokens no card do Kanban

O sistema SHALL exibir no card do Kanban o total de tokens quando houver ao menos um
valor registrado, seguindo o padrão visual dos demais indicadores do card. Sem tokens
registrados, o card NÃO SHALL exibir placeholder nem valor zero.

#### Scenario: Card com tokens

- **WHEN** um card possui entrada e/ou saída registradas
- **THEN** o card mostra o total de tokens no padrão dos indicadores existentes

#### Scenario: Card sem tokens

- **WHEN** um card não possui nenhum valor de token
- **THEN** nenhum indicador de tokens é renderizado no card

### Requirement: Exibição e edição de tokens no modal do item

O modal do item SHALL apresentar, na área de planejamento, campos de tokens de entrada e
de saída, editáveis para tasks folha por quem tem permissão de escrita, com o total
calculado visível. Campos vazios SHALL ser persistidos como nulos. Usuários sem escrita
SHALL ver os valores em modo leitura, sem controles.

#### Scenario: Membro edita tokens

- **WHEN** membro altera entrada e saída no modal e salva
- **THEN** o sistema persiste os valores e atualiza o total exibido

#### Scenario: Campos vazios salvos

- **WHEN** o modal é salvo sem preencher os campos de token
- **THEN** ambos são persistidos como nulos

#### Scenario: Leitura sem escrita

- **WHEN** usuário sem permissão de escrita abre o modal
- **THEN** os tokens aparecem somente leitura, sem controles de edição

### Requirement: Registro massivo de tokens

O sistema SHALL permitir registrar tokens de vários cards em uma única operação,
associando cada valor ao card informado e aplicando atomicidade por item. A operação NÃO
SHALL aplicar um mesmo valor a todos os cards nem interromper os demais itens válidos por
causa de uma entrada inválida; cada falha SHALL identificar o item responsável.

#### Scenario: Lote com valores distintos

- **WHEN** uma operação em lote informa tokens diferentes para vários cards
- **THEN** cada card recebe exatamente o valor a ele associado

#### Scenario: Entrada inválida no lote

- **WHEN** uma entrada do lote é inválida (card inexistente, fora do tenant ou valor negativo)
- **THEN** a resposta aponta o item e o motivo, e os demais itens válidos são aplicados

#### Scenario: Isolamento do lote

- **WHEN** o lote inclui um card de outro projeto ou tenant
- **THEN** esse item é rejeitado sem afetar os demais

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
