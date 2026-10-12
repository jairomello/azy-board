# Spec Delta

## Purpose

Definir uma regra de numeração automatizada do build (`YYYY.MM.DD.N`) e a
exposição da versão e da data do build ao frontend e à API, para identificar
qual build está publicado.

## ADDED Requirements

### Requirement: Formato da versão do build

O sistema SHALL numerar cada build no formato `YYYY.MM.DD.N`, em que `YYYY.MM.DD`
é a data do build e `N` é um inteiro sequencial, começando em `1`, que conta os
builds daquele dia. A versão SHALL ser acompanhada da data do build.

#### Scenario: Primeiro build do dia

- **WHEN** o primeiro build de um dia é gerado
- **THEN** a versão tem o sufixo `N = 1` com a data daquele dia

#### Scenario: Builds seguintes no mesmo dia

- **WHEN** mais um build é gerado no mesmo dia
- **THEN** a versão incrementa o contador `N` mantendo a mesma data

#### Scenario: Build em outro dia reinicia o contador

- **WHEN** um build é gerado em um novo dia
- **THEN** a versão usa a nova data com `N` reiniciando em `1`

### Requirement: Geração automatizada da versão

A versão SHALL ser gerada automaticamente pelo processo de build, sem edição
manual de arquivo versionado, e SHALL ser derivada do estado do repositório de
forma reproduzível para o mesmo commit e a mesma data.

#### Scenario: Build gera a versão sem intervenção manual

- **WHEN** o build é executado em um clone limpo, sem alteração manual de versão
- **THEN** a versão `YYYY.MM.DD.N` é produzida e associada ao artefato gerado

#### Scenario: Sem valor de versão hardcoded

- **WHEN** o código ou os artefatos de configuração são inspecionados
- **THEN** não há número de versão de build fixado à mão como fonte de verdade

### Requirement: Exposição da versão ao frontend e à API

O sistema SHALL expor a versão e a data do build ao frontend para exibição, e
SHALL disponibilizar um endpoint público que retorna a versão e a data do build
publicado, sem exigir sessão e sem revelar segredos.

#### Scenario: Frontend recebe a versão do build

- **WHEN** o frontend é carregado
- **THEN** ele dispõe da versão e da data do build para exibição

#### Scenario: Endpoint público de versão

- **WHEN** um cliente requisita o endpoint público de versão sem sessão
- **THEN** a resposta inclui a versão e a data do build, sem segredos nem dados de usuário
