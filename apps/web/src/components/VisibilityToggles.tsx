interface VisibilityToggleProps {
  id: string
  label: string
  hint: string
  checked: boolean
  disabled?: boolean
  onChange: (valor: boolean) => void
}

function VisibilityToggle({ id, label, hint, checked, disabled = false, onChange }: VisibilityToggleProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-foreground cursor-pointer">{label}</label>
        <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
          checked ? 'bg-primary' : 'bg-muted-foreground/30'
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-all ${
            checked ? 'left-[1.125rem]' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  )
}

interface VisibilityTogglesProps {
  restricted: boolean
  hidden: boolean
  onChangeRestricted: (valor: boolean) => void
  onChangeHidden: (valor: boolean) => void
  restrictedLabel: string
  restrictedHint: string
  hiddenLabel: string
  hiddenHint: string
  restrictedId: string
  hiddenId: string
  disabled?: boolean
}

// Controles de "Restrito" e "Oculto", usados no cadastro e nas configurações do projeto.
export function VisibilityToggles({
  restricted,
  hidden,
  onChangeRestricted,
  onChangeHidden,
  restrictedLabel,
  restrictedHint,
  hiddenLabel,
  hiddenHint,
  restrictedId,
  hiddenId,
  disabled = false,
}: VisibilityTogglesProps) {
  return (
    <div className="rounded-lg border border-border divide-y divide-border px-3 py-1">
      <VisibilityToggle
        id={restrictedId}
        label={restrictedLabel}
        hint={restrictedHint}
        checked={restricted}
        disabled={disabled}
        onChange={onChangeRestricted}
      />
      <VisibilityToggle
        id={hiddenId}
        label={hiddenLabel}
        hint={hiddenHint}
        checked={hidden}
        disabled={disabled}
        onChange={onChangeHidden}
      />
    </div>
  )
}
