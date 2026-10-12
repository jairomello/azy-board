# Versão do build

O Azy Board identifica cada build com uma versão no formato **`YYYY.MM.DD.N`**:

- `YYYY.MM.DD` é a data do build em **UTC**;
- `N` é um contador que **reinicia em `1` a cada dia** e conta os builds daquele dia.

A versão é sempre acompanhada da **data do build** nos pontos onde é exibida.

## Como a versão é gerada

A numeração é **automatizada** — não há número de versão fixado à mão. O script
[`scripts/build-version.ts`](../scripts/build-version.ts) calcula a versão a partir
do estado do repositório (data do build + número de commits do dia) e grava o
arquivo `.build-info.json` na raiz. É reproduzível para o mesmo commit e a mesma
data, e não usa arquivo de estado.

O pipeline pode injetar o contador pela variável `AZYBOARD_BUILD_NUMBER`; sem ela,
o valor é derivado do repositório.

A geração faz parte de `bun run build` (etapa `build:version`) e também pode ser
executada isoladamente:

```bash
bun run build:version          # grava .build-info.json
bun run build:version --json   # imprime { version, buildDate, number }
```

`bun run build:web` embute a versão e a data no bundle web; a API as resolve em
tempo de execução a partir de `.build-info.json` (embarcado na imagem) ou de
`AZYBOARD_BUILD_VERSION`/`AZYBOARD_BUILD_DATE`.

## Como conferir a versão publicada

Depois de publicar, confira a versão em qualquer um destes pontos:

- **Tela de login**: a versão e a data aparecem num canto da tela, mesmo sem sessão.
- **Shell do sistema**: na barra lateral, abaixo de "Trabalho conectado".
- **Endpoint público**: `GET /version` responde `{ "version": "YYYY.MM.DD.N", "buildDate": "YYYY-MM-DD" }` sem exigir sessão e sem expor segredos. Útil para verificar a versão implantada pela API.

Se a versão exibida for `dev`, o artefato foi executado sem o `.build-info.json`
(por exemplo, em desenvolvimento local).
