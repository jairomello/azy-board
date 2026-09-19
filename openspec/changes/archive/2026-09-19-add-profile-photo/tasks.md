## 1. Dependências e configuração

- [x] 1.1 Adicionar `sharp` (Apache-2.0) em `apps/api/package.json` e validar o funcionamento no runtime Bun; se houver incompatibilidade, usar `jimp` (MIT) mantendo o mesmo contrato
- [x] 1.2 Adicionar `react-easy-crop` (MIT) em `apps/web/package.json`
- [x] 1.3 Documentar em `apps/api/.env.example` os limites `MAX_AVATAR_SIZE` (padrão 819200 bytes = 800 KB) e as dimensões fixas 256×256

## 2. Banco e armazenamento de avatar

- [x] 2.1 Adicionar a tabela `user_avatars` em `apps/api/src/db/schema.ts` (PK composta `(tenant_id, user_id)`, `mime_type`, `size_bytes`, `width`, `height`, `content_hash`, `data` BLOB, `updated_at`, FKs para `tenants`/`users` com cascade) com comentário `// [TENANT]`
- [x] 2.2 Gerar a migration append-only com `bun run db:generate` e conferir a entrada em `apps/api/src/db/migrations/meta/_journal.json`
- [x] 2.3 Adicionar a guarda de integridade correspondente em `apps/api/src/db/integrity.ts`
- [x] 2.4 Criar a porta `AvatarStore` e a implementação `DatabaseAvatarStore` em `apps/api/src/services/avatarStore.ts`, marcando o ponto de troca de storage com `// [DB-SWAP]`
- [x] 2.5 Implementar a normalização de imagem em `apps/api/src/services/avatarImage.ts` (autoOrient por EXIF, resize/recorte 256×256, conversão WebP com fallback JPEG, remoção de metadados e cálculo de hash SHA-256)

## 3. API de foto de perfil

- [x] 3.1 Implementar parsing de `multipart/form-data` com validação por assinatura binária (magic bytes), allowlist de MIME e limite de tamanho
- [x] 3.2 Implementar `PUT /api/users/me/avatar` em `apps/api/src/routes/users.ts`: ler arquivo, normalizar, gravar no `AvatarStore`, atualizar `users.avatar_url` com URL versionada e retornar `{ user }`
- [x] 3.3 Implementar `DELETE /api/users/me/avatar`: remover o registro do `AvatarStore`, limpar `users.avatar_url` e retornar `{ user }`
- [x] 3.4 Implementar `GET /api/users/:userId/avatar` em `apps/api/src/routes/users.ts`: filtrar sempre por `tenant_id` (`// [TENANT]`), exigir autenticação, responder `inline` com `Content-Type` correto, `X-Content-Type-Options: nosniff`, `ETag` e `Cache-Control` e honrar `If-None-Match` com `304`
- [x] 3.5 Garantir que as consultas de usuário/listagens continuem selecionando apenas `avatar_url` e nunca o BLOB `data`
- [x] 3.6 Revalidar os contratos existentes (login, `/auth/me`, cards/work logs) confirmando que `avatarUrl` permanece o mesmo campo

## 4. Frontend — upload, recorte e exibição

- [x] 4.1 Adicionar helper `api.upload` em `apps/web/src/lib/api.ts` para `FormData` (sem definir `Content-Type` manualmente)
- [x] 4.2 Criar resolvedor de URL com base path (ex.: `apps/web/src/lib/appUrl.ts`) e usá-lo em `apps/web/src/components/UserAvatar.tsx`
- [x] 4.3 Criar helper de recorte/compressão no cliente (`apps/web/src/lib/avatarImage.ts`: canvas 256×256 → WebP/JPEG) com teste de unidade
- [x] 4.4 Criar componente de editor de recorte com `react-easy-crop` (zoom, enquadramento quadrado, preview e acessibilidade)
- [x] 4.5 Adicionar a seção de foto de perfil em `apps/web/src/pages/AccountPage.tsx` com controles de alterar/remover e estados de carregamento/erro
- [x] 4.6 Estender `apps/web/src/contexts/AuthContext.tsx` com método para atualizar o usuário após upload/remoção e refletir em todos os avatares

## 5. i18n

- [x] 5.1 Adicionar as chaves da foto de perfil (título, alterar, remover, instruções do editor, limites e erros) em `apps/web/src/i18n/locales/{pt-BR,en,es}/settings.json`
- [x] 5.2 Rodar `bun run check:i18n` garantindo paridade nos três idiomas

## 6. Testes

- [x] 6.1 Testes de integração da API: upload válido normaliza e retorna `user`; arquivo inválido e acima do limite são rejeitados; `DELETE` volta `avatarUrl` para `null`; `GET` serve com headers e responde `304`
- [x] 6.2 Teste de integração de isolamento: usuário de outro tenant recebe `404` ao acessar a foto
- [x] 6.3 Teste de migration e da guarda de integridade da nova tabela
- [x] 6.4 Teste de contrato do `UserAvatar`: resolve base path e cai para iniciais quando não há foto
- [x] 6.5 Teste de unidade do helper de compressão/recorte no cliente (canvas mockado)

## 7. Verificação

- [x] 7.1 Rodar `bun run check` (typecheck + lint + testes + build)
- [x] 7.2 Rodar `bun run test:migrations` e `bun run test:smoke`
- [x] 7.3 Validar manualmente: editor de recorte, upload, remoção, sincronização entre dispositivos e deploy path-based
- [x] 7.4 Rodar `openspec validate --change add-profile-photo`
- [x] 7.5 Registrar `Board ref: 54719d47-0fd4-4364-8de1-7c5927d386b5` nos artefatos e fechar o card T2 (`complete_task`), confirmando no board que o status é `DONE`
