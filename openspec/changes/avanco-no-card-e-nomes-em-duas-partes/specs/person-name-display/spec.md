# Spec Delta

## Purpose

Definir como nomes de pessoas são exibidos nas superfícies de leitura do produto, para que nomes longos não quebrem o layout sem perder a identificação da pessoa.

## ADDED Requirements

### Requirement: Nome de pessoa exibido em duas partes

As superfícies de leitura que exibem nomes de pessoas SHALL reduzir o nome a duas partes — a primeira e a última — e SHALL limitar o resultado a 24 caracteres, cortando com reticências quando exceder. O nome completo SHALL permanecer acessível por tooltip ou rótulo acessível, e SHALL NOT ser alterado em campos de escolha ou de edição.

#### Scenario: Nome com mais de duas partes

- **WHEN** o nome cadastrado é "Thiago Corrêa Simas de Melo Porto"
- **THEN** a superfície exibe "Thiago Porto" e o tooltip mostra o nome completo

#### Scenario: Nome curto permanece legível

- **WHEN** o nome cadastrado é "Jairo Silva"
- **THEN** a superfície exibe "Jairo Silva" sem cortes

#### Scenario: Nome acima do limite é cortado com reticências

- **WHEN** o nome em duas partes passa de 24 caracteres
- **THEN** a superfície corta o excesso e acrescenta reticências, mantendo o nome completo no tooltip

#### Scenario: Nome único não inventa sobrenome

- **WHEN** o nome cadastrado tem uma única parte
- **THEN** a superfície exibe essa parte, sem repetir nem completar o nome

#### Scenario: Chip de filtro ativo do board

- **WHEN** um filtro de Responsável ou Autor está ativo com um nome longo
- **THEN** o chip exibe o nome em duas partes e mantém o nome completo no rótulo acessível

#### Scenario: Eixo da carga da equipe

- **WHEN** o dashboard exibe a carga da equipe de alguém com nome longo
- **THEN** o eixo do gráfico exibe o nome em duas partes e o tooltip mostra o nome completo

#### Scenario: Coluna Responsável da árvore

- **WHEN** a árvore exibe a coluna Responsável de um item cujo responsável tem nome longo
- **THEN** a coluna exibe o nome em duas partes com o nome completo acessível

#### Scenario: Campo de escolha preserva o nome completo

- **WHEN** o usuário abre a seleção de responsável ou autor
- **THEN** as opções listam o nome completo, sem abreviação
