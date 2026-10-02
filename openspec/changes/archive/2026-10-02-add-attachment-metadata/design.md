## Context

A tabela `attachments` tem hoje: `id`, `tenant_id`, `item_id`, `filename` (basename armazenado `uuid_nome`), `original_name`, `mime_type`, `size`, `storage_path`, `storage_provider`, `created_at`. Não há campos de metadados humanos nem endpoint de edição (apenas POST upload, GET list/download, DELETE).

Inconsistência atual relevante: o `POST` retorna `filename` = nome original do upload, mas o `GET` lista retorna `filename` = basename armazenado. O nome original só reaparece no `Content-Disposition` do download. O novo campo `label` (default = `original_name`) resolve a exibição de forma consistente.

Infraestrutura reaproveitável: `RichTextEditor` (Tiptap lazy, formato canônico Markdown via `htmlToMarkdown`), `MarkdownText` para renderização read-only, `formatters.ts` para datas, padrão de contract tests web.

## Goals / Non-Goals

**Goals:**
- Metadados opcionais (nome, data de referência, descrição rich text) por anexo, com sugestão automática no upload
- Edição via UI e API com as mesmas regras de autorização/tenancy dos anexos atuais
- Defaults materializados no banco (não computados em leitura) para estabilidade das respostas
- Migração aditiva segura em SQLite e PostgreSQL, com backfill de `label` para anexos existentes

**Non-Goals:**
- Busca/full-text em metadados de anexos
- Versionamento de anexos ou histórico de edição dos metadados
- Ferramenta MCP de escrita de metadados (pode vir depois; `list_attachments` já refletirá os campos)
- Ordenação/filtragem da lista por metadados
- Alterar comportamento de upload/download/segurança existente

## Decisions

### Decisão 1: Nomes dos campos — `label`, `referenceDate`, `description`

- `label` (texto, até 200 chars, nullable): nome amigável. Distinto de `original_name` (imutável, vindo do upload) e de `filename` (basename de storage).
- `referenceDate` (texto ISO `YYYY-MM-DD`, nullable): data a que o documento se refere. Preferido a `attachmentDate` por evitar ambiguidade com `created_at` (data de upload).
- `description` (texto Markdown, até 20000 chars, nullable): mesmo limite e formato canônico das demais descrições do produto.

**Alternativa rejeitada:** calcular fallback de exibição em leitura (`label ?? originalName`). Rejeitada porque tornaria a edição ambígua (o usuário não distinguiria valor sugerido de valor gravado) e perpetuaria a divergência POST/GET. Defaults são gravados no insert.

### Decisão 2: Defaults materializados no upload

No `POST`: `label = campos opcionais do form ?? original_name`, `referenceDate = campo do form ?? data do upload (YYYY-MM-DD de created_at)`, `description = campo do form ?? null`. Gravados no insert — o usuário pode sobrescrever depois via PATCH; nada é re-calculado em leitura.

### Decisão 3: Novo endpoint PATCH (edição parcial)

`PATCH /projects/:projectId/items/:itemId/attachments/:attachmentId`, papel mínimo MEMBER, corpo `{ label?, referenceDate?, description? }`:
- `label`: string até 200 chars; `null` limpa (volta a exibir fallback de UI com `originalName` apenas visualmente — o campo no banco fica nulo)
- `referenceDate`: string ISO `YYYY-MM-DD` válida; `null` limpa
- `description`: string Markdown até 20000; `null` limpa
- Campos ausentes = não alterados (patch parcial)
- Exige `tenantAttachmentSettings.enabled` (409 quando desabilitado), mesma regra de POST/DELETE — leitura continua permitida
- Ancora item no tenant/projeto (anti-IDOR) como as demais rotas
- Resposta 200 com o anexo atualizado; broadcast `ITEM_UPDATED`
- `expectedUpdatedAt` opcional para concorrência otimista (mesmo padrão de PATCH de itens)

**Alternativa rejeitada:** PUT completo — exigiria echo de todos os campos e não agrega; o padrão do projeto é patch parcial (ex.: `update_item`).

### Decisão 4: Migração aditiva + backfill

- SQLite `0036_attachment-metadata.sql`: `ALTER TABLE attachments ADD COLUMN label text; ADD COLUMN reference_date text; ADD COLUMN description text;` + `UPDATE attachments SET label = original_name WHERE label IS NULL;`
- Postgres `0007_attachment-metadata.sql`: espelho (ADD COLUMN nullable ×3 + UPDATE de backfill)
- Colunas nullable sem default → migração instantânea, sem rebuild de tabela (SQLite ALTER ADD COLUMN é O(1))
- Rollback: colunas nullable órfãs são inofensivas; não é necessário down migration

### Decisão 5: Contrato de resposta e tipos

- `GET` lista de anexos: acrescentar `label`, `referenceDate`, `description`, `originalName` aos itens; manter `filename` como está (compat)
- `Attachment` em `packages/ui-contracts`: novos campos **opcionais** (`label?: string | null` etc.) — clientes que não conhecem os campos continuam funcionando
- Detalhe do item (`routes/items.ts`) já serializa `AttachmentRecord`: incluir os campos novos no record (`persistence/models.ts`) propaga automaticamente

### Decisão 6: UI — exibição e edição na aba de anexos

- Lista: nome exibido = `label ?? originalName`; data de referência formatada (`formatDate`); descrição renderizada com `MarkdownText` (colapsada se longa)
- Edição: formulário inline por anexo (visível para `canEdit`), com input de nome, `input type="date"` e `RichTextEditor` lazy para descrição; salvar via PATCH; sem alteração do fluxo de upload (defaults automáticos já vêm do servidor)
- Acessibilidade e i18n: novas chaves `attachmentName`, `attachmentReferenceDate`, `attachmentDescription`, `attachmentEdit`, `attachmentSave`, `attachmentSaved`, `attachmentSaveError` nos 3 locales

## Risks / Trade-offs

- **[Risco] Spec principal desatualizada**: a change `add-card-attachments` não foi arquivada; `openspec/specs/file-attachments/spec.md` não contém o delta dela. → Mitigação: este delta usa apenas ADDED (não toca requisitos existentes); recomenda-se arquivar a change anterior antes de arquivar esta.
- **[Risco] Bundle da aba de anexos**: `RichTextEditor` (Tiptap ~338 KB) na edição de descrição. → Mitigação: o componente já é lazy (`React.lazy` + ErrorBoundary) e só carrega ao abrir o formulário de edição.
- **[Risco] Divergência de dialectos**: migrations/queries em SQLite e Postgres. → Mitigação: colunas nullable simples, adapters com testes nos dois perfis; `bun run check:persistence` garante fronteiras.
- **[Trade-off] `label` duplica `original_name` no caso default**: aceito — `original_name` permanece imutável como registro do upload; `label` é a camada de exibição editável.

## Migration Plan

1. Migrations aditivas (SQLite 0036 / Postgres 0007) com backfill de `label`
2. Deploy: API aplica migrations na inicialização do container (fluxo padrão)
3. Rollback: reverter código; colunas nullable permanecem sem efeito

## Open Questions

_(nenhuma — nomes de campos e defaults decididos conforme o card; ajustar em review se desejado)_