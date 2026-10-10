import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ICON_CATALOG, ICON_CATEGORIES, type IconCategoryId } from '@azy-board/ui-contracts'
import { iconComponent } from '../lib/iconCatalog'

interface Props {
  value: string | null
  onChange: (icon: string | null) => void
}

// Galeria de ícones do catálogo compartilhado, com filtro por categoria,
// busca e opção de limpar (default).
export function IconPicker({ value, onChange }: Props) {
  const { t } = useTranslation('common')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<IconCategoryId | 'all'>('all')

  const options = useMemo(() => {
    const scoped = category === 'all' ? ICON_CATALOG : ICON_CATEGORIES.find(item => item.id === category)?.icons ?? []
    const term = search.trim().toLowerCase()
    return term ? scoped.filter(name => name.includes(term)) : scoped
  }, [search, category])

  const categoryClass = (active: boolean) =>
    `px-2 py-0.5 text-[11px] rounded-full border ${active ? 'border-primary bg-primary/10 text-primary' : 'border-transparent text-muted-foreground hover:bg-muted'}`

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 flex-wrap" aria-label={t('appearance.category')}>
        <button
          type="button"
          aria-pressed={category === 'all'}
          onClick={() => setCategory('all')}
          className={categoryClass(category === 'all')}
        >
          {t('appearance.allIcons')}
        </button>
        {ICON_CATEGORIES.map(item => (
          <button
            key={item.id}
            type="button"
            aria-pressed={category === item.id}
            onClick={() => setCategory(item.id)}
            className={categoryClass(category === item.id)}
          >
            {t(`appearance.categories.${item.id}`)}
          </button>
        ))}
      </div>
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
