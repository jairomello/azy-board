# Versão do build

O Azy Board identifica cada build com uma versão no formato **`YYYY.MM.DD.N`**:

- `YYYY.MM.DD` é a data do build em **UTC**;
- `N` é um contador que **reinicia em `1` a cada dia** e conta os builds daquele dia.

A interface exibe **somente o número da versão** — a data já está dentro dele. A
**data do build** continua sendo produzida, transportada e servida pelo endpoint
público de versão, para conferir qual build está publicado sem abrir o repositório.

## Como a versão é gerada

A numeração é **automatizada** — não há número de versão fixado à mão. O script
[`scripts/build-version.ts`](../scripts/build-version.ts) calcula a versão a partir
do estado do repositório (data do build + número de commits do dia) e grava o
arquivo `.build-info.json` na raiz. É reproduzível para o mesmo commit e a mesma
data, e não usa arquivo de estado.

O pipeline pode injetar a versão já resolvida por
`AZYBOARD_BUILD_VERSION` (com `AZYBOARD_BUILD_DATE`); o contador sozinho pode ser
injetado por `AZYBOARD_BUILD_NUMBER`. O override tem precedência sobre o cálculo
local — é ele que garante que a imagem da API e a do web do mesmo build carreguem
exatamente a mesma versão, já que o build dentro da imagem roda sem `.git`.

A geração faz parte de `bun run build` (etapa `build:version`) e também pode ser
executada isoladamente:

```bash
bun run build:version          # grava .build-info.json
bun run build:version --json   # imprime { version, buildDate, number }
```

`bun run build:web` embute a versão e a data no bundle web; a API as resolve em
tempo de execução a partir de `.build-info.json` (embarcado na imagem) ou de
`AZYBOARD_BUILD_VERSION`/`AZYBOARD_BUILD_DATE`.

## Como a versão chega às imagens publicadas

O job `publish-production-images` resolve a versão **uma única vez**
(`bun run scripts/build-version.ts --json`, em um checkout com histórico completo)
e a injeta como build args nas duas imagens. Na API, os args alimentam o
`.build-info.json` gerado dentro do build; no web, os mesmos valores viram
`__APP_VERSION__`/`__BUILD_DATE__` no bundle do Vite. A prioridade no bundle é
env do pipeline → `.build-info.json` → `dev`.

`bun run check:deploy-versions` reprova quando os Dockerfiles deixam de declarar e
repassar esses args ou quando o job de publicação deixa de calculá-los e injetá-los.

## Como conferir a versão publicada

Depois de publicar, confira a versão em qualquer um destes pontos:

- **Tela de login**: a versão aparece num canto da tela, mesmo sem sessão.
- **Shell do sistema**: na barra lateral, abaixo de "Trabalho conectado".
- **Endpoint público**: `GET /version` responde `{ "version": "YYYY.MM.DD.N", "buildDate": "YYYY-MM-DD" }` sem exigir sessão e sem expor segredos. O mesmo conteúdo está em `GET /api/version`, que fica atrás do prefixo encaminhado pelo proxy do web. Útil para verificar a versão implantada pela API.

Se a versão exibida for `dev`, o artefato foi executado sem a versão injetada. Em
desenvolvimento isso é esperado (não há pipeline nem `.build-info.json`); em um
ambiente publicado, é defeito de build — o pipeline deve injetar
`AZYBOARD_BUILD_VERSION`, e `bun run check:deploy-versions` acusa quando esse
repasse se perde.
