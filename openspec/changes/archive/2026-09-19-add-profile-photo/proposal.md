## Why

O board exibe avatar por iniciais (`UserAvatar`) e todas as respostas de item/login já carregam `users.avatarUrl`, mas não existe nenhuma forma de definir uma foto: o campo `avatar_url` nasce `null`, `PATCH /users/me` rejeita `avatarUrl` e não há endpoint de upload, processamento nem serving. O requisito "Foto de perfil e avatar do usuário" já existe em `openspec/specs/auth/spec.md` (linhas 100–113), porém nunca foi implementado. O card T2 pede a funcionalidade de forma **simples e segura**, sem acoplar ao subsistema de anexos de documentos.

## What Changes

- **Mini editor no cliente**: ao escolher uma imagem, o usuário recorta/zoom num enquadramento quadrado e a aplicação comprime para 256×256 antes de enviar (preview imediato, menos banda, menos erro).
- **Upload e remoção**: `PUT /api/users/me/avatar` (multipart) e `DELETE /api/users/me/avatar`; a resposta devolve o `user` atualizado para sincronizar a UI.
- **Normalização server-side autoritativa**: a imagem é decodificada, orientada pelo EXIF, redimensionada para 256×256 e recodificada (WebP/JPEG) sem metadados — garantia de formato real mesmo se o cliente for driblado.
- **Limites e validação**: somente imagens comuns (PNG, JPEG, WebP, GIF estático, AVIF, BMP), tamanho máximo de upload de 800 KB (configurável) e verificação por assinatura binária (magic bytes), não apenas `Content-Type` declarado.
- **Armazenamento dedicado, separado de anexos** (decisão de design, com prós/contras em `design.md`): bytes em tabela própria `user_avatars` (BLOB) com isolamento por tenant; `users.avatar_url` continua sendo o contrato, agora com URL versionada (`/api/users/{id}/avatar?v={hash}`). Sem reutilizar `attachments`/`storage.ts`/outbox de limpeza.
- **Serving autorizado e cacheável**: `GET /api/users/:userId/avatar` valida que o solicitante pertence ao mesmo tenant, responde `inline` com `X-Content-Type-Options: nosniff` e cache/ETag baseados no hash do conteúdo.
- **UI e i18n**: seção de foto no topo da `AccountPage`, com botões de alterar/remover, estado vazio por iniciais; textos nos três idiomas (`pt-BR`, `en`, `es`) no namespace `settings`.
- **Sem migration destrutiva**: `users.avatar_url` já existe; a entrega adiciona apenas a tabela nova via migration append-only.

## Capabilities

### New Capabilities
<!-- Nenhuma: a capacidade de avatar já está declarada em `auth`. -->

### Modified Capabilities
- `auth`: completa o requisito existente "Foto de perfil e avatar do usuário" com editor/recorte, limites e formatos, normalização 256×256 sem metadados, armazenamento dedicado separado de anexos, remoção com retorno às iniciais e serving autorizado/cacheável.
- `account-settings`: a seção de perfil da página de configurações passa a permitir alterar e remover a foto, além de apenas exibi-la.

## Impact

- **Contratos:** `apps/web/src/contexts/AuthContext.tsx` (`User`, novo método de atualização de avatar); eventualmente `packages/types/src/index.ts` se o tipo de usuário público for centralizado.
- **Banco:** `apps/api/src/db/schema.ts` (nova tabela `user_avatars`, FKs para `tenants`/`users`, índice por `(tenant_id, user_id)`) + migration append-only e guarda de integridade. `users.avatar_url` permanece.
- **API:** `apps/api/src/routes/users.ts` (rotas `PUT/DELETE /users/me/avatar`, `GET /users/:userId/avatar`), `apps/api/src/validation.ts` (limites/formatos), `apps/api/src/index.ts` (montagem). `auth.ts` não muda: login e `/auth/me` já retornam `avatarUrl`.
- **Web:** `apps/web/src/pages/AccountPage.tsx`, novo componente de editor (crop/zoom), `apps/web/src/components/UserAvatar.tsx` (resolver de base path), `apps/web/src/lib/api.ts` (helper de upload multipart), `apps/web/src/i18n/locales/*/settings.json`.
- **Dependências:** `sharp` (Apache-2.0) no backend e `react-easy-crop` (MIT) no frontend; ambas compatíveis com a política de licenças do `openspec/config.yaml`.
- **Rastreabilidade:** Board ref: 54719d47-0fd4-4364-8de1-7c5927d386b5 (card T2).
- **Fora de escopo:** fileserver/object storage para documentos, CDN, histórico de versões da foto, editor com filtros avançados, upload por agentes/API Key.
