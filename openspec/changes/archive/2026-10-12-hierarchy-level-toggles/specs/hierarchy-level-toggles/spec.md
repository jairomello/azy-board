# Spec Delta

## Purpose

Permitir que projetos hierárquicos simplifiquem a exibição ocultando, de forma
independente e reversível, os níveis de módulo e de épico, recolhendo a estrutura
a um módulo e/ou épico único.

## ADDED Requirements

### Requirement: Opções independentes de ocultar módulos e épicos

O sistema SHALL oferecer, para projetos `HIERARCHICAL`, duas opções independentes
e opcionais: ocultar módulos e ocultar épicos. As opções SHALL ser persistidas por
projeto, ter default desligado e ser ignoradas em projetos `SIMPLE`.

#### Scenario: Default desligado

- **WHEN** um projeto hierárquico é criado sem informar as opções
- **THEN** o sistema persiste ambas como desligadas e exibe todos os níveis

#### Scenario: Apenas módulos ocultos

- **WHEN** a opção de ocultar módulos está ligada e a de épicos desligada
- **THEN** o nível de módulo deixa de ser exibido e os épicos continuam visíveis

#### Scenario: Apenas épicos ocultos

- **WHEN** a opção de ocultar épicos está ligada e a de módulos desligada
- **THEN** os módulos continuam visíveis e o nível de épico deixa de ser exibido

#### Scenario: Ambos ocultos

- **WHEN** as duas opções estão ligadas
- **THEN** o sistema exibe histórias e cards diretamente sob o projeto, sem módulos nem épicos

#### Scenario: Projeto simples ignora as opções

- **WHEN** o projeto é `SIMPLE`
- **THEN** as opções não alteram a apresentação atual do board simples

### Requirement: Recolhimento a módulo único

Ao ligar a opção de ocultar módulos, o sistema SHALL, em transação atômica
escopada por tenant e projeto, garantir um único módulo (criando um quando não
existir), reparentar épicos e histórias a ele e remover os módulos supérfluos,
preservando cards, IDs, conteúdo e relações.

#### Scenario: Projeto sem módulos

- **WHEN** a opção é ligada em um projeto sem módulos
- **THEN** o sistema cria um módulo único e vincula os épicos e histórias existentes a ele

#### Scenario: Projeto com vários módulos

- **WHEN** a opção é ligada em um projeto com vários módulos
- **THEN** o sistema move os épicos/histórias para o módulo único e remove os demais módulos, sem excluir cards

#### Scenario: Atomicidade e isolamento

- **WHEN** qualquer passo do recolhimento falha
- **THEN** o sistema faz rollback, mantém o estado anterior e retorna erro, sem atravessar tenant/projeto

### Requirement: Recolhimento a épico único

Ao ligar a opção de ocultar épicos, o sistema SHALL, em transação atômica escopada
por tenant e projeto, garantir um único épico por módulo (criando um quando não
existir), reparentar as histórias a ele e remover os épicos supérfluos,
preservando cards, IDs, conteúdo e relações.

#### Scenario: Projeto sem épicos no módulo

- **WHEN** a opção é ligada em um módulo sem épicos
- **THEN** o sistema cria um épico único no módulo e vincula as histórias a ele

#### Scenario: Projeto com vários épicos

- **WHEN** a opção é ligada em um projeto com vários épicos
- **THEN** o sistema move as histórias para o épico único e remove os demais épicos, sem excluir cards

#### Scenario: Módulos também ocultos

- **WHEN** as opções de módulos e épicos são ligadas em conjunto
- **THEN** o épico único fica sob o módulo único e as histórias vinculam-se a ele

### Requirement: Reversibilidade das opções

O sistema SHALL permitir desligar as opções a qualquer momento, reexibindo o nível
correspondente. O item único SHALL permanecer e SHALL poder ser renomeado, e novos
módulos e épicos SHALL poder ser criados. Desligar SHALL NOT excluir cards.

#### Scenario: Desligar volta a exibir o nível

- **WHEN** o usuário desliga a opção de ocultar módulos ou épicos
- **THEN** o nível correspondente volta a ser exibido com o item único presente

#### Scenario: Editar o único e criar novos

- **WHEN** o usuário, após desligar uma opção, renomeia o item único e cria novos itens daquele nível
- **THEN** o sistema persiste a renomeação e exibe os novos módulos/épicos

#### Scenario: Nenhum card é perdido

- **WHEN** qualquer opção é ligada ou desligada
- **THEN** TASKs, BUGs, subtasks e histórias permanecem com IDs e conteúdo preservados

### Requirement: Exposição e edição das opções

O sistema SHALL persistir as opções no projeto, retorná-las nas respostas de
leitura e aceitar alterá-las por ADMIN via `PATCH /projects/:id` e na criação do
projeto. MEMBER e VIEWER SHALL ver o estado sem alterá-lo.

#### Scenario: Leitura retorna as opções

- **WHEN** um cliente autenticado requisita `GET /projects/:id`
- **THEN** a resposta inclui as duas opções (falso quando não ligadas)

#### Scenario: ADMIN altera as opções

- **WHEN** um ADMIN envia `PATCH /projects/:id` ligando ou desligando uma opção
- **THEN** o sistema aplica o recolhimento correspondente e retorna o projeto atualizado

#### Scenario: Escrita restrita

- **WHEN** um MEMBER ou VIEWER tenta alterar as opções
- **THEN** o sistema rejeita a operação sem modificar a estrutura
