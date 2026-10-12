import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { AccordionSection } from './AccordionSection'

export interface RunActivityRun {
  id: string
  status: string
  model?: string | null
  tools?: { toolName: string; displayName?: string; status: string }[]
}

// Card T55 — atividade de execução do run em accordion: o nome do modelo vem
// primeiro e as etapas (ferramentas/status) aparecem empilhadas. Não expõe
// raciocínio privado do modelo; o conteúdo são apenas etapas de execução.
const TERMINAL_STATUSES = ['COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED']
const WAITING_STATUSES = ['WAITING_USER', 'WAITING_APPROVAL']

export function RunActivity({ run }: { run: RunActivityRun }) {
  const { t } = useTranslation('assistant')
  const [open, setOpen] = useState(false)
  const active = ![...TERMINAL_STATUSES, ...WAITING_STATUSES].includes(run.status)
  const hasContent = Boolean(run.model) || Boolean(run.tools?.length)
  if (!hasContent) return null

  return (
    <AccordionSection
      id={`run-activity-${run.id}`}
      title={active ? t('processing') : t('runActivity')}
      summary={active ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      isOpen={open}
      onToggle={() => setOpen(current => !current)}
    >
      <div className="space-y-2 text-xs">
        {run.model && (
          <p className="flex items-center gap-2">
            <span className="font-semibold text-foreground">{t('runModel')}:</span>
            <span className="min-w-0 truncate text-muted-foreground">{run.model}</span>
          </p>
        )}
        {run.tools?.length ? (
          <ul className="space-y-1">
            {run.tools.map((tool, index) => (
              <li
                key={`${tool.toolName}-${index}`}
                className="flex items-center justify-between gap-2 rounded bg-muted px-2 py-1 text-muted-foreground"
              >
                <span className="min-w-0 truncate">{tool.displayName ?? tool.toolName.replace(/_/g, ' ')}</span>
                <span className="shrink-0">{tool.status}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </AccordionSection>
  )
}
