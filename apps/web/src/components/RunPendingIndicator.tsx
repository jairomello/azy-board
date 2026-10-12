import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

// Indicador de resposta pendente: aparece imediatamente após o envio da
// mensagem e permanece até surgirem etapas, texto transmitido ou estado terminal.
export function RunPendingIndicator() {
  const { t } = useTranslation('assistant')
  return (
    <div
      role="status"
      className="mr-3 inline-flex items-center gap-2 rounded-xl bg-muted p-3 text-sm text-muted-foreground"
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      {t('thinking')}
    </div>
  )
}
