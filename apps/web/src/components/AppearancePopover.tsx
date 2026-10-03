import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { IconPicker } from './IconPicker'
import { ColorSwatches } from './ColorSwatches'

export interface AppearanceValue {
  icon: string | null
  color: string | null
}

interface Props {
  icon: string | null
  color: string | null
  onChange: (value: AppearanceValue) => void
  disabled?: boolean
  // 'live': propaga a cada escolha (padrão dos formulários de projeto).
  // 'manual': mantém a seleção pendente e só propaga em "Aplicar" (modal de item).
  applyMode?: 'live' | 'manual'
  children: ReactNode
  triggerClassName?: string
  triggerAriaLabel?: string
  triggerTitle?: string
}

interface DropdownPos { top: number; left: number; width: number }

// Popover de aparência (ícone + cor). O menu permanece aberto ao escolher; fecha
// apenas em "Aplicar", no próprio gatilho ou em clique fora. O listener de
// mousedown ignora o conteúdo do portal (inclusive a barra de rolagem), que
// antes fechava o menu ao arrastar.
export function AppearancePopover({
  icon,
  color,
  onChange,
  disabled = false,
  applyMode = 'live',
  children,
  triggerClassName = '',
  triggerAriaLabel,
  triggerTitle,
}: Props) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const [pendingIcon, setPendingIcon] = useState<string | null>(icon)
  const [pendingColor, setPendingColor] = useState<string | null>(color)
  const [pos, setPos] = useState<DropdownPos>({ top: 0, left: 0, width: 300 })
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const updatePos = useCallback(() => {
    const element = containerRef.current
    if (!element) return
    const rect = element.getBoundingClientRect()
    setPos({ top: rect.bottom + window.scrollY + 6, left: rect.left + window.scrollX, width: 300 })
  }, [])

  function openMenu() {
    setPendingIcon(icon)
    setPendingColor(color)
    updatePos()
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    function handleOutside(event: MouseEvent) {
      const target = event.target as Node
      if (containerRef.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  function selectIcon(next: string | null) {
    setPendingIcon(next)
    if (applyMode === 'live') onChange({ icon: next, color: pendingColor })
  }

  function selectColor(next: string | null) {
    setPendingColor(next)
    if (applyMode === 'live') onChange({ icon: pendingIcon, color: next })
  }

  function apply() {
    onChange({ icon: pendingIcon, color: pendingColor })
    setOpen(false)
  }

  function clear() {
    setPendingIcon(null)
    setPendingColor(null)
    if (applyMode === 'live') onChange({ icon: null, color: null })
  }

  const dropdown = open && typeof document !== 'undefined' ? createPortal(
    <div
      ref={dropdownRef}
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
      className="bg-popover border border-border rounded-lg shadow-xl p-3 space-y-3"
      role="dialog"
      aria-label={t('appearance.choose')}
      onMouseDown={event => event.stopPropagation()}
    >
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{t('appearance.icon')}</p>
        <IconPicker value={pendingIcon} onChange={selectIcon} />
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{t('appearance.color')}</p>
        <ColorSwatches value={pendingColor} onChange={selectColor} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={clear} className="text-xs text-muted-foreground hover:text-foreground">
          {t('appearance.clear')}
        </button>
        <button
          type="button"
          onClick={apply}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition"
        >
          {t('appearance.apply')}
        </button>
      </div>
    </div>,
    document.body,
  ) : null

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        disabled={disabled}
        aria-label={triggerAriaLabel}
        title={triggerTitle}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={triggerClassName}
      >
        {children}
      </button>
      {dropdown}
    </div>
  )
}
