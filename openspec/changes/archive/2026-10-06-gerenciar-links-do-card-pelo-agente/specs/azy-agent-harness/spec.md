## ADDED Requirements

### Requirement: Links do item na conversa

O harness SHALL conduzir as mutações de link (`create_item_link`, `update_item_link`, `delete_item_link`) pelo mesmo fluxo de aprovação das demais mutações, exibindo no preview o nome e a URL do link (e a descrição, quando houver) em vez do JSON cru. O alvo SHALL ser explícito: edição e remoção exigem `linkId` previamente obtido; o harness NÃO SHALL inferir o link a alterar apenas do foco da tela quando houver ambiguidade. Como as mutações usam payload canônico, repetições equivalentes na mesma run SHALL ser tratadas como a mesma operação.

#### Scenario: Preview exibe nome e URL

- **WHEN** o agente propõe `create_item_link` ou `update_item_link` com nome e URL
- **THEN** a prévia de aprovação exibe o nome e a URL do link antes de executar

#### Scenario: Alteração exige alvo explícito

- **WHEN** o usuário pede para editar um link sem que um `linkId` tenha sido resolvido
- **THEN** o agente lista os links e usa o `linkId` correspondente antes de propor a mutação

#### Scenario: Repetição não duplica

- **WHEN** o modelo emite duas vezes a mesma chamada de mutação de link na mesma run
- **THEN** o harness não executa a segunda, tratando como repetição ou operação já executada
