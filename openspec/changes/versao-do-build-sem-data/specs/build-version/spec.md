# Spec Delta

## MODIFIED Requirements

### Requirement: Formato da versão do build

O sistema SHALL numerar cada build no formato `YYYY.MM.DD.N`, em que `YYYY.MM.DD` é a
data do build e `N` é um inteiro sequencial, começando em `1`, que conta os builds
daquele dia. A data do build SHALL continuar sendo produzida e transportada junto da
versão para diagnóstico, mas SHALL NOT ser exibida na interface ao lado da versão.

#### Scenario: Primeiro build do dia

- **WHEN** o primeiro build de um dia é gerado
- **THEN** a versão tem o sufixo `N = 1` com a data daquele dia

#### Scenario: Builds seguintes no mesmo dia

- **WHEN** mais um build é gerado no mesmo dia
- **THEN** a versão incrementa o contador `N` mantendo a mesma data

#### Scenario: Build em outro dia reinicia o contador

- **WHEN** um build é gerado em um novo dia
- **THEN** a versão usa a nova data com `N` reiniciando em `1`

#### Scenario: Versão exibida apenas como número

- **WHEN** a interface exibe a versão do build
- **THEN** mostra somente `YYYY.MM.DD.N`, sem repetir a data do build ao lado

### Requirement: Exposição da versão ao frontend e à API

O sistema SHALL expor a versão do build ao frontend para exibição, sem a data do build
na interface, e SHALL disponibilizar um endpoint público que retorna a versão e a data
do build publicado, sem exigir sessão e sem revelar segredos. O endpoint SHALL ser
alcançável pela mesma origem que serve o app, respondendo em `/version` e em
`/api/version`.

#### Scenario: Frontend recebe a versão do build

- **WHEN** o frontend publicado é carregado
- **THEN** ele dispõe da versão e da data do build embutidas no artefato e exibe somente a versão

#### Scenario: Data do build não aparece na interface

- **WHEN** o usuário vê a versão do build na tela de login ou na barra lateral do shell
- **THEN** aparece apenas a versão no formato `YYYY.MM.DD.N`, sem a data do build ao lado

#### Scenario: Endpoint público de versão

- **WHEN** um cliente requisita o endpoint público de versão sem sessão
- **THEN** a resposta inclui a versão e a data do build, sem segredos nem dados de usuário

#### Scenario: Endpoint alcançável pela origem do app

- **WHEN** um cliente requisita `/version` ou `/api/version` na origem que serve a aplicação, sem sessão
- **THEN** recebe a versão e a data do build em JSON, nunca o HTML da aplicação
