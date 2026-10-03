import { useTranslation } from 'react-i18next'
import { ICON_COLORS } from '@azy-board/ui-contracts'

interface Props {
  value: string | null
  onChange: (color: string | null) => void
}

// Paleta fixa de cores de ícone (mesma base das tags). `null` = cor padrão do tema.
export function ColorSwatches({ value, onChange }: Props) {
  const { t } = useTranslation('common')
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(null)}
        aria-label={t('appearance.defaultColor')}
        title={t('appearance.defaultColor')}
        aria-pressed={value === null}
        className={`w-5 h-5 rounded-full border-2 bg-transparent transition ${value === null ? 'border-foreground scale-110' : 'border-border'}`}
      />
      {ICON_COLORS.map(color => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          aria-label={color}
          title={color}
          aria-pressed={value === color}
          className={`w-5 h-5 rounded-full border-2 transition ${value === color ? 'border-foreground scale-110' : 'border-transparent'}`}
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  )
}
