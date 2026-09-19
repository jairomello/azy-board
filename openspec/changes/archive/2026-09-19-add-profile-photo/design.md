## Context

O campo `users.avatar_url` existe desde a migration inicial (`apps/api/src/db/migrations/0000_unified-item-model.sql:169`), é retornado por `POST /auth/login`, `GET /auth/me`, na listagem de usuários e nas respostas de cards/work logs, e `UserAvatar` já renderiza `<img>` quando há valor e iniciais coloridas quando é `null`. Falta somente o caminho de escrita: não há endpoint de upload, processamento de imagem nem serving — a rota estática `/uploads/*` foi removida por segurança (`apps/api/src/index.ts:73-79`) e os anexos usam um subsistema próprio (tabela `attachments`, `StorageAdapter` local, outbox de limpeza e rota de download autorizada).

Restrições relevantes:

- O card T2 pede explicitamente **não misturar** a foto de perfil com o fluxo de anexos de documentos, que exige um fileserver para arquivos grandes/volumosos.
- O produto roda hoje single-instance com SQLite, e o card T1 quer manter um "modo simples" (sem Redis/Postgres) para usos individuais ou até ~20 pessoas.
- `openspec/config.yaml` exige tenancy em toda tabela de negócio, tratamento Anti-IDOR e apenas dependências MIT/Apache-2.0/BSD/ISC/Public Domain.
- A spec `auth` já determina 256×256 px (linhas 100–113).
- O deploy é path-based opcional (`window.__BASE_PATH__`): o interceptor de `fetch` reescreve `/api/*`, mas `<img src>` **não** passa por ele, então URLs de imagem precisam de um resolvedor próprio.

## Goals / Non-Goals

**Goals:**
- Permitir ao usuário alterar e remover sua foto de perfil, com recorte/zoom e compressão antes do envio.
- Garantir no servidor imagem real, quadrada, 256×256, sem metadados e dentro de limite de tamanho.
- Guardar os bytes em armazenamento **dedicado, separado de anexos**, isolado por tenant.
- Servir a foto por rota autenticada, cacheável e versionada, sem rota estática pública.
- Manter `users.avatar_url` como contrato existente, preservando fallback por iniciais e sincronização entre dispositivos.
- Manter a operação simples (sem novo serviço, sem CDN) e compatível com SQLite e, no futuro, PostgreSQL.

**Non-Goals:**
- Fileserver/object storage para documentos grandes (permanece no escopo de anexos, não desta entrega).
- CDN, URLs públicas de longa duração, histórico/versões da foto, editor com filtros, recorte não quadrado.
- Upload de avatar por agentes/API Key ou edição da foto de outro usuário (por admin).
- GIF animado (será tratado como quadro estático) e vídeo.

## Decisions

### D1. Armazenamento dos bytes: tabela dedicada no banco (BLOB), não filesystem nem repositório

A foto normalizada (256×256, WebP/JPEG, tipicamente 10–40 KB) fica em uma tabela própria `user_avatars` (PK composta `(tenant_id, user_id)`, `mime_type`, `size_bytes`, `width`, `height`, `content_hash`, `data BLOB`, `updated_at`), com FK para `tenants`/`users` e cascade. `users.avatar_url` passa a guardar uma URL versionada: `/api/users/{userId}/avatar?v={content_hash}`.

Comparação das alternativas:

| Critério | (A) Tabela BLOB dedicada — **escolhida** | (B) Filesystem `uploads/avatars` | (C) Pasta dentro do repositório | (D) Object storage |
| --- | --- | --- | --- | --- |
| Backup/restore | Um único arquivo (`dev.db`) | Precisa banco + volume juntos | Repo + volume (pior) | Terceiro sistema |
| Órfãos / limpeza | Inexistente (transacional) | Precisa de rotina/outbox | Precisa de rotina | Lifecycle policies |
| Serving seguro | Query com tenant, sem rota estática | Precisa de rota autorizada nova | Precisa servir arquivo do repo | URLs assinadas |
| Path traversal / permissões | Não se aplica | Precisa sanitizar | Alto risco | Não se aplica |
| Multi-instância futura | Funciona sem mudança | Quebra sem storage compartilhado | Quebra | Funciona |
| Migração SQLite→Postgres | `BLOB`→`bytea` | Sem mudança | Sem mudança | Sem mudança |
| Tamanho do banco | Cresce de forma limitada (~40 KB/usuário) | Banco leve | Banco leve | Banco leve |
| Complexidade inicial | Baixa | Média (route + cleanup + perms) | Média/alta + risco de commit | Alta (credenciais, SDK) |

**Por que não o filesystem/repositório, que era a ideia inicial do card:** dados de runtime não devem ser versionados no repositório (histórico git, privacidade, bloat) e o diretório do repositório pode ser substituído em deploy/rebuild, perdendo as fotos. Se fosse filesystem, o correto seria um volume persistente (como `uploads/`), o que reintroduz rota autorizada, limpeza de órfãos e backup em duas partes — exatamente a complexidade que o card pede para evitar. Para imagens pequenas e limitadas, o banco é operacionalmente **mais leve e mais seguro**, e a preocupação de "banco pesado" se aplica a documentos arbitrários (que continuam no futuro fileserver de anexos), não a avatares normalizados. A separação fica garantida por não reutilizar `attachments`/`storage.ts`/outbox.

Para permitir troca futura por object storage sem tocar nas rotas, a leitura/gravação passa por uma porta pequena (`AvatarStore`) com implementação `DatabaseAvatarStore` (marcar ponto de troca com `// [DB-SWAP]`).

### D2. Processamento: editor no cliente **e** normalização autoritativa no servidor

- **Cliente:** o editor (D3) recorta/zoom em moldura quadrada e, no confirmar, desenha em `<canvas>` 256×256 e exporta WebP (qualidade ~0.85; fallback JPEG). Isso dá preview instantâneo, reduz banda e já entrega imagem leve.
- **Servidor:** mesmo assim a API decodifica com `sharp` (Apache-2.0), aplica `autoOrient` (EXIF), redimensiona/corta para 256×256, converte para WebP/JPEG e descarta metadados antes de gravar. Alternativas: aceitar apenas o que o cliente mandar (frágil se o cliente for driblado ou antigo) e `jimp` (MIT, puro JS, sem binário nativo, porém mais lento e mais pesado em memória). `sharp` é a escolha por ser o padrão maduro e rápido; se houver atrito com o runtime Bun, o fallback documentado é `jimp`, sem impacto de contrato.

### D3. Editor de recorte: `react-easy-crop` (MIT) + canvas

`react-easy-crop` cobre arraste/zoom/touch/teclado com pouco código e licença MIT; o canvas nativo faz o recorte final e a codificação. Alternativa considerada: cropper 100% próprio em canvas (sem dependência nova, porém mais propenso a bugs de DPR/touch). A dependência é exclusiva do frontend e pequena.

### D4. Serving: rota autenticada e versionada, sem estático público

`GET /api/users/:userId/avatar` responde apenas se o solicitante autenticado pertence ao **mesmo tenant** do usuário alvo (query sempre filtrada por `(tenant_id, user_id)`; `// [TENANT]`), com `Content-Type` correto, `Content-Disposition: inline`, `X-Content-Type-Options: nosniff`, `ETag` = `content_hash` e `Cache-Control: private, max-age=86400, immutable`, honrando `If-None-Match` → `304`. A mudança da foto troca o `v` na URL, invalidando caches. URLs de avatar nunca apontam para arquivos do disco.

### D5. Contrato e base path

`avatarUrl` continua sendo o campo consumido por cards/work logs/login (nenhuma mudança de contrato), agora com o caminho versionado. Como `<img>` não passa pelo interceptor de `fetch`, adiciona-se um resolvedor (ex.: `resolveAppUrl`) que prefixa `window.__BASE_PATH__` quando o caminho começa com `/api/`, usado por `UserAvatar` e pela página de conta. Em dev (`BASE_PATH` vazio) nada muda.

### D6. Limites e validação

Upload máximo de **800 KB** (configurável por env, ex.: `MAX_AVATAR_SIZE`), formatos PNG/JPEG/WebP/AVIF/BMP e GIF estático, validação por assinatura binária (magic bytes) além do `Content-Type`, e rejeição de dimensões absurdas antes do processamento. Após a normalização, todo arquivo é quadrado e 256×256.

### D7. Persistência e migração

Nenhuma alteração em `users.avatar_url`. A entrega cria apenas a tabela `user_avatars` via migration append-only (`drizzle-kit generate`) com guarda de integridade correspondente em `integrity.ts`. Rollback = reverter o código; a tabela pode permanecer sem efeito e as fotos existentes continuam servíveis por qualquer versão que já tenha a rota.

## Risks / Trade-offs

- **`sharp` no Bun** (binário nativo): validar no início da implementação; se houver incompatibilidade, trocar por `jimp` (mesmo contrato) sem refazer rotas/UI.
- **Crescimento do banco**: aceitável e limitado (256×256 comprimido); o BLOB fica em tabela separada justamente para não inflar as consultas de usuário. Mitigação adicional: nunca incluir `data` em listagens.
- **Base path quebrado em `<img>`**: coberto por resolvedor dedicado e teste de contrato do `UserAvatar`.
- **Cache servindo foto antiga**: versionamento por hash na query e ETag resolvem; ao remover, `avatar_url` volta a `null`.
- **GIF animado/EXIF malicioso**: processamento no servidor pega o primeiro quadro e remove metadados; magic bytes barram conteúdo não-imagem.
- **Múltiplas instâncias**: o banco compartilhado já resolve (vantagem sobre filesystem local).
- **Privacidade cross-tenant**: toda query de leitura/escrita filtra `tenant_id`; testes de integração cobrem isolamento.

## Migration Plan

1. Migration append-only cria `user_avatars` (sem tocar dados existentes; `avatar_url` permanece `null` para todos).
2. Subir API e web juntos; usuários sem foto continuam com iniciais.
3. Rollback: reverter código. A tabela pode ficar; nenhuma outra rota depende dela e nenhum dado de usuário é perdido.
4. Futuro: trocar `DatabaseAvatarStore` por um store de object storage atrás da mesma porta, se/quando o "modo avançado" (T1) chegar.

## Open Questions

- Confirmar `sharp` no Bun na primeira tarefa; fallback `jimp` já definido.
- Formato final: WebP como padrão (melhor compressão) com JPEG quando o cliente não suportar. Defaults propostos; ajustável sem impacto de contrato.
