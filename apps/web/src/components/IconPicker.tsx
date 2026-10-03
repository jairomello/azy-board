import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ICON_CATALOG } from '@azy-board/ui-contracts'
import { iconComponent } from '../lib/iconCatalog'

interface Props {
  value: string | null
  onChange: (icon: string | null) => void
}

// Galeria de ícones do catálogo compartilhado, com busca e opção de limpar (default).
export function IconPicker({ value, onChange }: Props) {
  const { t } = useTranslation('common')
  const [search, setSearch] = useState('')

  const options = useMemo(() => {
    const term = search.trim().toLowerCase()
    return term ? ICON_CATALOG.filter(name => name.includes(term)) : ICON_CATALOG
  }, [search])

  return (
    <div className="space-y-2">
      <input
        value={search}
        onChange={event => setSearch(event.target.value)}
        placeholder={t('appearance.searchIcon')}
        aria-label={t('appearance.searchIcon')}
        className="w-full px-2 py-1 text-xs bg-background border border-border rounded outline-none focus:border-primary"
      />
      <div className="grid grid-cols-8 gap-1 max-h-44 overflow-y-auto" role="listbox" aria-label={t('appearance.icon')}>
        <button
          type="button"
          role="option"
          aria-selected={value === null}
          aria-label={t('appearance.defaultIcon')}
          title={t('appearance.defaultIcon')}
          onClick={() => onChange(null)}
          className={`flex items-center justify-center h-7 rounded border text-xs text-muted-foreground ${value === null ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-muted'}`}
        >
          —
        </button>
        {options.map(name => {
          const Icon = iconComponent(name)
          return (
            <button
              key={name}
              type="button"
              role="option"
              aria-selected={value === name}
              aria-label={name}
              title={name}
              onClick={() => onChange(name)}
              className={`flex items-center justify-center h-7 rounded border ${value === name ? 'border-primary bg-primary/10 text-primary' : 'border-transparent text-foreground hover:bg-muted'}`}
            >
              {Icon ? <Icon className="w-4 h-4" /> : null}
            </button>
          )
        })}
      </div>
      {options.length === 0 && <p className="text-xs text-muted-foreground">{t('appearance.noIconFound')}</p>}
    </div>
  )
}
