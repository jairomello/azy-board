## ADDED Requirements

### Requirement: Edição de versão pela conversa com paridade à tela

O sistema SHALL permitir que o Azy Agent edite `name`, `releaseDate`, `description` e `status` de uma versão existente pela conversa, com a mesma validação e permissão da seção "Versões" da tela de configurações. O agente SHALL poder definir um valor (`SET`) e limpar um campo opcional (`CLEAR`), este último restrito a `releaseDate` e `description`, produzindo o mesmo efeito de “Sem versão”/descrição vazia. `status` SHALL ser restrito a `PLANNED`, `IN_DEV`, `RELEASED` e `CANCELLED`. A edição NÃO SHALL alterar o vínculo de itens à versão nem remover a versão.

#### Scenario: Renomear versão

- **WHEN** o usuário pede para renomear uma versão e confirma a prévia
- **THEN** apenas o nome da versão é alterado

#### Scenario: Marcar versão como liberada e registrar data

- **WHEN** o usuário pede para marcar uma versão como liberada e informar a data
- **THEN** `status` passa a `RELEASED` e `releaseDate` é persistida, com a mudança refletida na tela

#### Scenario: Limpar data ou descrição

- **WHEN** o usuário pede para remover a data de lançamento ou a descrição de uma versão
- **THEN** o campo correspondente é definido como vazio, sem alterar os demais campos nem o vínculo de itens

#### Scenario: Status inválido é rejeitado

- **WHEN** a edição informa um `status` fora do enum permitido
- **THEN** o sistema rejeita com erro acionável e a versão permanece inalterada

### Requirement: Criação de versão com campos completos pela conversa

O sistema SHALL permitir criar uma versão pela conversa informando, além do nome, `releaseDate`, `description` e `status`, com paridade à tela de configurações. A criação informando apenas o nome SHALL continuar válida.

#### Scenario: Criar versão com data e situação

- **WHEN** o usuário pede para criar a versão v1.0.0 com data de lançamento e situação `IN_DEV`
- **THEN** a versão é criada com nome, data e situação informados

#### Scenario: Criar versão só com nome

- **WHEN** o usuário pede para criar uma versão informando apenas o nome
- **THEN** a versão é criada com a situação padrão, como hoje
