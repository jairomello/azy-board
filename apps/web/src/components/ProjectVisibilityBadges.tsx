import { useTranslation } from 'react-i18next'
import { EyeOff, Lock, type LucideIcon } from 'lucide-react'
import { Tooltip } from './ui/Tooltip'

interface VisibilityBadgeProps {
  icon: LucideIcon
  label: string
  tooltip: string
  className: string
}

function VisibilityBadge({ icon: Icon, label, tooltip, className }: VisibilityBadgeProps) {
  return (
    <Tooltip label={tooltip} position="top">
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${className}`}>
        <Icon className="h-3 w-3" aria-hidden="true" />
        {label}
      </span>
    </Tooltip>
  )
}

interface ProjectVisibilityBadgesProps {
  // Opcionais: payloads antigos ou vindos de mutação do assistente podem não trazer os campos.
  isRestricted?: boolean
  isHidden?: boolean
}

// Sinalizações de visibilidade exibidas no card do projeto.
export function ProjectVisibilityBadges({ isRestricted, isHidden }: ProjectVisibilityBadgesProps) {
  const { t } = useTranslation()
  const restrito = Boolean(isRestricted)
  const oculto = Boolean(isHidden)
  if (!restrito && !oculto) return null

  return (
    <>
      {restrito && (
        <VisibilityBadge
          icon={Lock}
          label={t('projectVisibility.restricted')}
          tooltip={t('projectVisibility.restrictedTooltip')}
          className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800"
        />
      )}
      {oculto && (
        <VisibilityBadge
          icon={EyeOff}
          label={t('projectVisibility.hidden')}
          tooltip={t('projectVisibility.hiddenTooltip')}
          className="bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
        />
      )}
    </>
  )
}
