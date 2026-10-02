## Why

Os anexos de cards armazenam apenas dados técnicos (UUID, nome de arquivo, MIME, tamanho, data de upload). Usuários não conseguem dar um nome amigável ao anexo, registrar a data a que o documento se refere nem descrever seu conteúdo — o que reduz a utilidade dos anexos como evidência e documentação do card (ex.: especificações, prints de bug, documentos de referência).

## What Changes

- Novos metadados **opcionais** por anexo:
  - `label` — nome amigável de exibição (até 200 caracteres)
  - `referenceDate` — data de referência do documento (ISO `YYYY-MM-DD`)
  - `description` — descrição em rich text, armazenada em Markdown canônico (mesmo padrão da descrição do card)
- **Sugestão automática no upload**: `label` default = nome original do arquivo; `referenceDate` default = data do upload; `description` vazia. O usuário pode gravar sem alterar nada.
- Novo endpoint `PATCH /projects/:projectId/items/:itemId/attachments/:attachmentId` para editar os metadados (papel MEMBER; bloqueado quando anexos estiverem desabilitados no tenant, mesma regra de upload/delete).
- `POST` de upload passa a aceitar os metadados opcionais no multipart (clientes de API podem definir já no envio).
- Listagem (`GET`) e detalhe do item retornam os novos campos; tipo `Attachment` em `packages/ui-contracts` estendido com campos opcionais (compatível com clientes atuais).
- UI na aba de anexos do card: exibir nome/data/descrição e formulário de edição (descrição com `RichTextEditor` lazy já existente).
- Backfill em migration: anexos existentes recebem `label = original_name`.
- i18n pt-BR/en/es para os novos rótulos.

## Capabilities

### New Capabilities

_(nenhuma — a funcionalidade pertence à capability existente `file-attachments`)_

### Modified Capabilities

- `file-attachments`: novos requisitos ADDED de metadados opcionais (nome, data de referência, descrição rich text), edição via PATCH e defaults automáticos no upload. Requisitos existentes de upload/download/segurança não mudam de comportamento.

## Impact

- **Banco**: `apps/api/src/db/schema.ts` (tabela `attachments`) + `apps/api/src/db/postgres/schema.ts`; migrations aditivas SQLite (0036) e Postgres (0007) com backfill de `label`
- **Persistência**: `persistence/models.ts` (`AttachmentRecord`, `NewAttachmentRecord`, novo patch type), `persistence/ports.ts` (`FilePort.updateAttachment`), adapters SQLite e Postgres
- **API**: `routes/attachments.ts` (POST, GET list, novo PATCH), `routes/items.ts` (detalhe do item já retorna anexos)
- **Contratos**: `packages/ui-contracts` (interface `Attachment`)
- **Frontend**: `apps/web/src/components/AttachmentsArea.tsx`, reaproveitando `RichTextEditor`/`MarkdownText`/`formatters`
- **i18n**: `board.json` nos 3 locales
- **MCP**: `list_attachments` retorna os novos campos automaticamente (proxy do GET); sem ferramenta de escrita nova nesta change
- **Testes**: estender `integration.test.ts` (segurança de anexos), `adapter.test.ts`; contract test web
- **Pendente relacionado**: a change `add-card-attachments` está implementada mas não arquivada — a spec principal `file-attachments` ainda não recebeu o delta dela. Este delta usa apenas ADDED (sem conflito), mas recomenda-se arquivar a change anterior antes desta para manter a spec coerente.
- **Board ref**: T10 — Campos adicionais nos anexos (`c810e0d0-40bc-45fd-92cb-9c19f75bc42e`)