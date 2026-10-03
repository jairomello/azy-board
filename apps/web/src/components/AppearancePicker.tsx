import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { iconComponent } from '../lib/iconCatalog'
import { IconPicker } from './IconPicker'
import { ColorSwatches } from './ColorSwatches'

interface Props {
  icon: string | null
  color: string | null
  onChange: (next: { icon: string | null; color: string | null }) => void
  disabled?: boolean
}

interface DropdownPos { top: number; left: number; width: number }

// Seletor combinado de ícone e cor usado em projeto e item. Segue o padrão de
// dropdown com portal (sem Radix) para não onerar o bundle.
export function AppearancePicker({ icon, color, onChange, disabled = false }: Props) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const [dropdownPos, setDropdownPos] = useState<DropdownPos>({ top: 0, left: 0, width: 280 })
  const containerRef = useRef<HTMLDivElement>(null)

  const updatePos = useCallback(() => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setDropdownPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, width: Math.max(rect.width, 280) })
  }, [])

  useEffect(() => {
    if (!open) return
    function handleClose(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClose)
    return () => document.removeEventListener('mousedown', handleClose)
  }, [open])

  const Preview = iconComponent(icon)
  const dropdown = open ? (
    <div
      style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 9999 }}
      className="bg-popover border border-border rounded-lg shadow-xl p-3 space-y-3"
      onMouseDown={event => event.preventDefault()}
    >
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{t('appearance.icon')}</p>
        <IconPicker value={icon} onChange={next => onChange({ icon: next, color })} />
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{t('appearance.color')}</p>
        <ColorSwatches value={color} onChange={next => onChange({ icon, color: next })} />
      </div>
      <button
        type="button"
        onClick={() => { onChange({ icon: null, color: null }); setOpen(false) }}
        className="w-full text-left text-xs text-primary hover:underline"
      >
        {t('appearance.clear')}
      </button>
    </div>
  ) : null

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => { updatePos(); setOpen(current => !current) }}
        className="flex items-center gap-2 px-2.5 py-1.5 text-sm border border-border rounded-lg bg-background hover:bg-muted disabled:opacity-50 transition"
      >
        <span style={{ color: color ?? undefined }} className="flex items-center justify-center w-4 h-4">
          {Preview ? <Preview className="w-4 h-4" /> : <span className="text-muted-foreground text-xs">—</span>}
        </span>
        <span className="text-muted-foreground">{t('appearance.choose')}</span>
      </button>
      {typeof document !== 'undefined' && createPortal(dropdown, document.body)}
    </div>
  )
}
