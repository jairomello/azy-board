import { useTranslation } from 'react-i18next'

/**
 * Vaga de destino do arraste (Card T89): caixa tracejada com a altura exata do card
 * arrastado, desenhada na coluna e no índice que a prévia resolver. Decorativa —
 * não é clicável, não é focável e não entra na contagem de cards da coluna.
 */
export function CardDropPlaceholder({ height, index }: { height: number; index: number }) {
  const { t } = useTranslation('board')
  return (
    <div className="kanban-card-placeholder" style={{ height }} data-preview-index={index} aria-hidden="true">
      <span className="drop-placeholder__label">{t('dragDropHere')}</span>
    </div>
  )
}
