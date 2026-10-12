# Proposal

## Why

Hoje não existe uma identificação de versão do build publicada: o deploy usa
tags `sha-<hex>` das imagens, mas nem a tela de login nem o sistema exibem qual
versão está no ar. Não há como olhar a produção e saber se os ajustes já foram
publicados.

Board ref: T60 (item `4d12abaf-d55c-45fa-a0aa-ac4206626c09`).

## What Changes

- Adota uma **regra de numeração automatizada de build** no formato
  `YYYY.MM.DD.N` (data do build + contador `N` do dia), sempre acompanhada da
  data do build. O valor é gerado pelo próprio build, sem edição manual.
- O build passa a expor versão e data:
  - no **canto da tela de login** (fixo, visível sem sessão);
  - dentro do sistema, na **sidebar esquerda, abaixo de "Trabalho conectado"**;
  - em um endpoint público de versão da API, para conferir a versão implantada
    independentemente da tela.
- O texto de versão/ data é internacionalizado (PT-BR, EN, ES).

## Capabilities

### New Capabilities
- `build-version`: regra de numeração automatizada do build (`YYYY.MM.DD.N`),
  geração no build, formatação com data e exposição da versão ao frontend e à
  API pública.

### Modified Capabilities
- `integrated-login`: a tela de login passa a exibir a versão do build e a data
  em um canto da tela.
- `integrated-app-shell`: a sidebar passa a exibir a versão do build e a data
  abaixo de "Trabalho conectado".
- `continuous-integration`: o pipeline de build/CI passa a gerar e propagar a
  versão `YYYY.MM.DD.N` para os artefatos publicados.

## Impact

- **Frontend**: injeção da versão/data no bundle web; exibição em `LoginPage` e
  em `AppShell` (sidebar); novas chaves de i18n.
- **Backend**: endpoint público de versão (liveness/informação de build).
- **Build/CI**: script de geração da versão e sua propagação para web, API e
  imagens; documentação de deploy.
- **Sem migração de banco** e sem novas dependências de runtime.
