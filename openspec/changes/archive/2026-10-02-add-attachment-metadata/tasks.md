## 1. Banco de dados

- [x] 1.1 Adicionar colunas `label`, `reference_date`, `description` (nullable) em `apps/api/src/db/schema.ts` (tabela `attachments`)
- [x] 1.2 Espelhar as colunas em `apps/api/src/db/postgres/schema.ts`
- [x] 1.3 Criar migration SQLite `0036_attachment-metadata.sql` (ALTER TABLE ADD COLUMN ×3 + backfill `label = original_name`)
- [x] 1.4 Criar migration Postgres `0007_attachment-metadata.sql` (espelho)
- [x] 1.5 Rodar `bun run db:migrate` e validar integridade (`bun run test:migrations`)

## 2. Persistência

- [x] 2.1 Estender `AttachmentRecord` e `NewAttachmentRecord` em `persistence/models.ts` (label, referenceDate, description)
- [x] 2.2 Adicionar `updateAttachment(context, projectId, itemId, attachmentId, patch)` ao `FilePort` em `persistence/ports.ts`
- [x] 2.3 Implementar no adapter SQLite (`db/sqlite/adapter.ts`): mapping + create com defaults + update
- [x] 2.4 Implementar no adapter Postgres (`db/postgres/adapter.ts`): mapping + create com defaults + update

## 3. API

- [x] 3.1 `POST` upload: aceitar campos opcionais do multipart e materializar defaults (label=originalName, referenceDate=data do upload)
- [x] 3.2 `GET` lista: retornar `label`, `referenceDate`, `description`, `originalName`
- [x] 3.3 Novo `PATCH /:attachmentId`: validação (label ≤200, referenceDate ISO, description ≤20000, null limpa), papel MEMBER, tenant enabled (409), anti-IDOR, `expectedUpdatedAt` opcional, broadcast `ITEM_UPDATED`
- [x] 3.4 Ajustar serialização de anexos no detalhe do item (`routes/items.ts`) se necessário
- [x] 3.5 Validar contrato de erro unificado (códigos + retryable) nos novos caminhos

## 4. Contratos compartilhados

- [x] 4.1 Estender interface `Attachment` em `packages/ui-contracts` com campos opcionais
- [x] 4.2 Verificar impacto em consumidores do tipo (web e MCP `list_attachments`)

## 5. Frontend

- [x] 5.1 `AttachmentsArea.tsx`: exibir `label ?? originalName`, data de referência formatada e descrição (MarkdownText, colapsável)
- [x] 5.2 Formulário de edição por anexo (gated por `canEdit`): input nome, input date, RichTextEditor lazy para descrição; salvar via PATCH com feedback de sucesso/erro
- [x] 5.3 Recarregar lista local após PATCH (padrão existente do componente) e refletir evento realtime
- [x] 5.4 Acessibilidade: labels, aria e foco no formulário de edição

## 6. i18n

- [x] 6.1 Adicionar chaves (`attachmentName`, `attachmentReferenceDate`, `attachmentDescription`, `attachmentEdit`, `attachmentSave`, `attachmentSaved`, `attachmentSaveError`) em `board.json` pt-BR, en e es
- [x] 6.2 Rodar `bun run check:i18n`

## 7. Testes

- [x] 7.1 API: estender `integration.test.ts` (defaults no upload, PATCH happy path, validação, VIEWER 403, disabled 409, cross-tenant 403/404, null limpa campo)
- [x] 7.2 Persistência: `adapter.test.ts` — create com defaults e update parcial nos dois dialectos
- [x] 7.3 Web: contract test do formulário/exibição de metadados (padrão `*-contract.test.ts`)

## 8. Validação e encerramento

- [x] 8.1 `bun run check` (typecheck + lint + testes + build)
- [x] 8.2 `bun run test:smoke`
- [x] 8.3 Atualizar `apps/mcp/README.md` se o formato de `list_attachments` mudar visivelmente
- [x] 8.4 Registrar `Board ref: c810e0d0-40bc-45fd-92cb-9c19f75bc42e` nos artefatos e, ao concluir a implementação, fechar o card T10 com `complete_task`