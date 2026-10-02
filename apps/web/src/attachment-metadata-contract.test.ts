// [CONTRATO-ESTRUTURAL] metadados de anexos (T10) — exibição, edição e i18n.
// A cobertura comportamental equivalente vive em apps/api/src/integration.test.ts.
import { describe, expect, test } from 'bun:test'

async function source(path: string) {
  return fetch(new URL(path, import.meta.url)).then(response => response.text())
}

function contains(text: string, expected: string) {
  expect(text.includes(expected)).toBe(true)
}

describe('contratos de metadados de anexos (card T10)', () => {
  test('AttachmentsArea exibe e edita label, data de referência e descrição', async () => {
    const area = await source('./components/AttachmentsArea.tsx')
    // Exibição com fallback label → originalName → filename
    contains(area, 'attachment.label ?? attachment.originalName ?? attachment.filename')
    contains(area, 'formatReferenceDate(attachment.referenceDate)')
    contains(area, '<MarkdownText content={attachment.description} />')
    // Formulário de edição gated por canEdit
    contains(area, "t('attachmentName')")
    contains(area, "t('attachmentReferenceDate')")
    contains(area, "t('attachmentDescription')")
    contains(area, 'type="date"')
    contains(area, 'maxLength={200}')
    contains(area, '<RichTextEditor')
    contains(area, 'canEdit && (')
    // Persistência via PATCH e atualização do estado local
    contains(area, 'api.patch<Attachment>')
    contains(area, "t('attachmentSaved')")
    contains(area, "t('attachmentSaveError')")
    // Data ISO exibida sem deslocamento de fuso
    contains(area, 'function formatReferenceDate')
  })

  test('ui-contracts declara os metadados como opcionais (compatibilidade)', async () => {
    const contracts = await source('../../../packages/ui-contracts/src/index.ts')
    contains(contracts, 'label?: string | null')
    contains(contracts, 'referenceDate?: string | null')
    contains(contracts, 'description?: string | null')
    contains(contracts, 'originalName?: string')
  })

  test('API expõe PATCH de metadados e serializa os novos campos', async () => {
    const routes = await source('../../api/src/routes/attachments.ts')
    contains(routes, "attachmentsRouter.patch('/:attachmentId', requireRole('MEMBER')")
    contains(routes, 'attachmentMetadataSchema')
    contains(routes, 'label: attachment.label')
    contains(routes, 'referenceDate: attachment.referenceDate')
    contains(routes, 'description: attachment.description')
    contains(routes, 'updateAttachment')
  })

  test('os três locales possuem as chaves de metadados', async () => {
    const keys = ['attachmentName', 'attachmentReferenceDate', 'attachmentDescription', 'attachmentEdit', 'attachmentSave', 'attachmentCancel', 'attachmentSaved', 'attachmentSaveError']
    for (const locale of ['pt-BR', 'en', 'es']) {
      const board = JSON.parse(await source(`./i18n/locales/${locale}/board.json`)) as Record<string, unknown>
      const missing = keys.filter(key => typeof board[key] !== 'string')
      expect({ locale, missing }).toEqual({ locale, missing: [] })
    }
  })
})
