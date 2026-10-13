# Design

## Context

Ver `proposal.md` para motivação. Estado atual relevante:

- A orientação do MCP vive em `apps/web/src/components/McpConnectionGuide.tsx`, renderizada no topo da `ApiKeysSection` (página `/account`).
- A skill canônica está em `skills/azyboard/` (`SKILL.md`, `commands/`, `references/`, `scripts/`, `manifest.json`, versão `1.0.1`), com espelho carregado por opencode em `.opencode/skills/azyboard/SKILL.md`, validado por `scripts/check-agent-skill.ts`.
- O download de recursos autenticados na web já usa `<a href={resolveAppUrl(url)} download>` (ver `AttachmentsArea.tsx` e `ProjectPlanningModal.tsx`), com cookie de sessão SameSite=Strict.
- O padrão de localizar arquivos que variam entre dev e imagem é o de `apps/api/src/buildInfo.ts`: `AZYBOARD_*` env → candidatos de caminho relativos ao cwd (`./`, `../../`, `../`) → fallback.
- O `Dockerfile` da API hoje não copia `skills/`; copia `apps/api/dist`, `packages`, `migrations` e `.build-info.json`.
- Não há biblioteca de `.zip` no workspace; Bun não expõe writer de zip, mas há `node:zlib` (deflateRaw + crc32) e `Bun.hash.crc32`.

## Goals / Non-Goals

**Goals:**

- Download self-service do `.zip` da skill a partir da seção de API Keys, sempre alinhado à versão da instalação.
- Empacotamento sem dependência nova de licença restritiva e sem segredos.
- Funcionar em dev e na imagem de produção.

**Non-Goals:**

- Buscar a skill mais recente de um repositório/release remoto (decisão: skill empacotada na instalação).
- Publicar o arquivo como asset estático público (decisão: endpoint autenticado).
- Alterar o conteúdo, os comandos ou as referências da skill.
- Versionar o `.zip` no repositório como artefato commitado.

## Decisions

### Endpoint autenticado `GET /api/skills/azyboard/download`

Rota própria sob `/api`, coberta pelo `authMiddleware`, seguindo a regra de que toda rota protegida exige sessão. Responde `application/zip` com `Content-Disposition: attachment; filename="azyboard-skill-<versão>.zip"`. Alternativa considerada: asset estático público no web/nginx — rejeitada por abrir exceção à regra de rotas protegidas e por separar a entrega da versão da API.

### Resolução do diretório da skill por configuração + candidatos

`AZYBOARD_SKILL_DIR` (env) tem prioridade; sem ela, tenta candidatos relativos ao cwd no mesmo espírito de `resolveApiBuildInfo`: `skills/azyboard`, `../../skills/azyboard`, `../skills/azyboard`. Isso cobre raiz do repo, `/app` na imagem e `apps/api` em runners locais. Se nenhum existir, o endpoint responde erro acionável (não 200 vazio). Alternativa considerada: embutir cada arquivo no bundle via import de texto — rejeitada por inflar o bundle e exigir regeneração a cada mudança na skill.

### Empacotamento `.zip` sem dependência nova

Módulo pequeno e testável em `apps/api/src/services/skillArchive.ts` que lista a árvore da skill, monta um `.zip` com deflate (`node:zlib.deflateRawSync`) e `crc32` (`Bun.hash.crc32` ou `zlib.crc32`), gravando entradas relativas à pasta raiz `azyboard/`. Alternativa considerada: `jszip`/`archiver` — rejeitada por adicionar dependência desnecessária. Alternativa: `tar.gz` via `Bun.Archive` — rejeitada porque o requisito pede `.zip` explicitamente.

### Cache em memória por assinatura da skill

O `.zip` é gerado sob demanda e memoizado em processo, invalidado pela assinatura do diretório (versão do manifest + mtime/tamanho dos arquivos). Evita recomprimir a cada requisição mantendo o resultado correto se a skill mudar em dev. Alternativa considerada: pré-gerar no build — rejeitada por introduzir risco de artefato obsoleto e mais um passo de build.

### Embarque da skill na imagem e nome do arquivo

`Dockerfile` copia `skills/azyboard` para `/app/skills/azyboard` e define `AZYBOARD_SKILL_DIR=/app/skills/azyboard`. O nome do arquivo usa a versão de `manifest.json` (fonte única da versão da skill). A "versão mais recente" é, por definição, a que acompanha a instalação.

### Botão por `<a download>` no frontend

O controle é um link com `download` e `href` resolvido por `resolveAppUrl('/api/skills/azyboard/download')`, reaproveitando o padrão de anexos e o suporte a base path. Sem `fetch`/`blob`, o navegador faz o download e o cookie de sessão é enviado automaticamente. Um estado de erro visível cobre falha de rede; o 401 segue o tratamento global de sessão.

## Risks / Trade-offs

- [`.zip` desatualizado em relação à skill] → Mitigado por gerar sob demanda a partir do diretório e por invalidar o cache pela assinatura.
- [Divergência entre raiz do repo e imagem] → Mitigado pelos candidatos de caminho e por `AZYBOARD_SKILL_DIR` explícito na imagem; teste cobre diretório ausente.
- [Implementação manual do formato `.zip`] → Mitigado por testes que abrem o arquivo com um leitor independente e verificam entradas e conteúdo; escopo restrito a deflate/store sem zip64.
- [Segredos na skill] → Mitigado pela verificação existente da skill (`test:agent-skill`) e por um teste que varre o conteúdo do `.zip` por padrões de chave.
- [Download exige sessão] → Usuários sem sessão recebem 401 (comportamento esperado e coberto pela spec de auth); o acesso é feito pela página de conta já autenticada.
