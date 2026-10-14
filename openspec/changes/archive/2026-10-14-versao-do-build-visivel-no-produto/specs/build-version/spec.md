# Spec Delta

## MODIFIED Requirements

### Requirement: Geração automatizada da versão

A versão SHALL ser gerada automaticamente pelo processo de build, sem edição
manual de arquivo versionado, e SHALL ser derivada do estado do repositório de
forma reproduzível para o mesmo commit e a mesma data. A versão SHALL ser
resolvida uma única vez por execução de build e transportada para os artefatos
de API e de web do mesmo commit, e nenhum artefato publicado SHALL cair no
fallback de desenvolvimento.

#### Scenario: Build gera a versão sem intervenção manual

- **WHEN** o build é executado em um clone limpo, sem alteração manual de versão
- **THEN** a versão `YYYY.MM.DD.N` é produzida e associada ao artefato gerado

#### Scenario: Sem valor de versão hardcoded

- **WHEN** o código ou os artefatos de configuração são inspecionados
- **THEN** não há número de versão de build fixado à mão como fonte de verdade

#### Scenario: Mesma versão nos artefatos de API e de web

- **WHEN** as imagens de API e de web do mesmo commit são publicadas
- **THEN** as duas reportam a mesma versão e a mesma data de build

#### Scenario: Contador avança em builds do mesmo dia

- **WHEN** dois builds são publicados no mesmo dia, inclusive quando o build acontece dentro da imagem, sem histórico git disponível
- **THEN** o segundo build usa um contador maior que o do primeiro, sem repetir a versão

#### Scenario: Artefato publicado não usa o fallback de desenvolvimento

- **WHEN** a imagem de web é construída pelo pipeline de publicação
- **THEN** o bundle embute a versão e a data do build, e a interface exibe a versão publicada em vez de "dev"

### Requirement: Exposição da versão ao frontend e à API

O sistema SHALL expor a versão e a data do build ao frontend para exibição, e
SHALL disponibilizar um endpoint público que retorna a versão e a data do build
publicado, sem exigir sessão e sem revelar segredos. O endpoint SHALL ser
alcançável pela mesma origem que serve o app, respondendo em `/version` e em
`/api/version`.

#### Scenario: Frontend recebe a versão do build

- **WHEN** o frontend publicado é carregado
- **THEN** ele dispõe da versão e da data do build embutidas no artefato para exibição

#### Scenario: Endpoint público de versão

- **WHEN** um cliente requisita o endpoint público de versão sem sessão
- **THEN** a resposta inclui a versão e a data do build, sem segredos nem dados de usuário

#### Scenario: Endpoint alcançável pela origem do app

- **WHEN** um cliente requisita `/version` ou `/api/version` na origem que serve a aplicação, sem sessão
- **THEN** recebe a versão e a data do build em JSON, nunca o HTML da aplicação

## ADDED Requirements

### Requirement: Coerência da versão do build no empacotamento

A verificação de coerência do deploy SHALL reprovar quando os Dockerfiles ou o
workflow de publicação deixarem de transportar a versão do build para os
artefatórios publicados.

#### Scenario: Dockerfile deixa de transportar a versão

- **WHEN** um Dockerfile que gera artefato publicado deixa de declarar e repassar a versão do build
- **THEN** a verificação de coerência falha indicando o arquivo e o argumento ausente

#### Scenario: Workflow não injeta a versão

- **WHEN** o job de publicação de imagens deixa de calcular e injetar a versão do build nas imagens
- **THEN** a verificação de coerência falha indicando o job
