interface BrandMarkProps {
  className?: string
}

export function BrandMark({ className = '' }: BrandMarkProps) {
  return (
    <img
      src="/brand/azyboard-logo.png"
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`block object-contain select-none ${className}`}
    />
  )
}

interface BrandLogoProps {
  className?: string
  markClassName?: string
  wordmarkClassName?: string
}

export function BrandLogo({
  className = '',
  markClassName = '',
  wordmarkClassName = '',
}: BrandLogoProps) {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <div className={`inline-flex items-center justify-center overflow-hidden ${markClassName}`}>
        <BrandMark className="w-full h-full" />
      </div>
      <strong className={`font-bold tracking-tight ${wordmarkClassName}`}>AzyBoard</strong>
    </div>
  )
}
