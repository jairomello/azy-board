import { useTranslation } from 'react-i18next'
import { iconComponent } from '../lib/iconCatalog'
import { AppearancePopover, type AppearanceValue } from './AppearancePopover'

interface Props {
  icon: string | null
  color: string | null
  onChange: (next: AppearanceValue) => void
  disabled?: boolean
}

// Campo de aparência dos formulários de projeto: ícone + cor com propagação
// imediata (applyMode 'live'). O dropdown é compartilhado com AppearancePopover.
export function AppearancePicker({ icon, color, onChange, disabled = false }: Props) {
  const { t } = useTranslation('common')
  const Preview = iconComponent(icon)
  return (
    <AppearancePopover
      icon={icon}
      color={color}
      onChange={onChange}
      disabled={disabled}
      applyMode="live"
      triggerAriaLabel={t('appearance.choose')}
      triggerTitle={t('appearance.choose')}
      triggerClassName="flex items-center gap-2 px-2.5 py-1.5 text-sm border border-border rounded-lg bg-background hover:bg-muted disabled:opacity-50 transition"
    >
      <span style={{ color: color ?? undefined }} className="flex items-center justify-center w-4 h-4">
        {Preview ? <Preview className="w-4 h-4" /> : <span className="text-muted-foreground text-xs">—</span>}
      </span>
      <span className="text-muted-foreground">{t('appearance.choose')}</span>
    </AppearancePopover>
  )
}
