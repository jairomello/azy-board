import type { ReactNode } from 'react'

interface TooltipProps {
  label: string
  children: ReactNode
  position?: 'bottom' | 'top'
}

export function Tooltip({ label, children, position = 'bottom' }: TooltipProps) {
  return (
    <div className="relative group flex-shrink-0">
      {children}
      <div
        className={`absolute z-50 pointer-events-none px-2 py-1 text-xs rounded-md bg-foreground text-background whitespace-nowrap
          opacity-0 group-hover:opacity-100 transition-opacity duration-150 delay-500
          ${position === 'bottom' ? 'top-full mt-1.5 left-1/2 -translate-x-1/2' : 'bottom-full mb-1.5 left-1/2 -translate-x-1/2'}`}
      >
        {label}
      </div>
    </div>
  )
}
