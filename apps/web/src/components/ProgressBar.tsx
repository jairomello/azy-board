import type { CSSProperties } from 'react'

export interface ProgressBarProps {
  /** Avanço de 0 a 100. Valores fora do intervalo são limitados. */
  value: number
  variant?: 'compact' | 'labeled'
  /** Rótulo curto para leitores de tela. */
  label: string
  /** Texto completo com percentual e contagem. Padrão: o próprio label. */
  valueText?: string
  /** Texto à esquerda, exibido apenas na variante `labeled`. */
  percentLabel?: string
  /** Texto à direita, exibido apenas na variante `labeled`. */
  countLabel?: string
  className?: string
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

/**
 * Barra de progresso única do produto.
 *
 * As cores vêm dos tokens do tema — nada de hex no componente. O trilho tem
 * marcas discretas a cada 25% e o preenchimento usa gradiente de avanço; em
 * 100%, usa o token de concluído. A transição é curta e o CSS global já a
 * neutraliza sob `prefers-reduced-motion`.
 */
export function ProgressBar({
  value,
  variant = 'compact',
  label,
  valueText,
  percentLabel,
  countLabel,
  className,
}: ProgressBarProps) {
  const percent = clamp(value)
  const done = percent === 100
  const showLabels = variant === 'labeled' && Boolean(percentLabel || countLabel)

  return (
    <div
      className={`progress-meter progress-meter--${variant}${done ? ' progress-meter--done' : ''}${className ? ` ${className}` : ''}`}
      data-progress-variant={variant}
      data-progress-state={done ? 'done' : 'partial'}
    >
      {showLabels && (
        <div className="progress-meter__labels">
          <span className="progress-meter__percent">{percentLabel}</span>
          <span className="progress-meter__count">{countLabel}</span>
        </div>
      )}
      <div
        className="progress-meter__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={label}
        aria-valuetext={valueText ?? label}
      >
        <span className="progress-meter__marks" aria-hidden="true" />
        <span
          className="progress-meter__fill"
          style={{ '--progress-value': `${percent}%` } as CSSProperties}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}
