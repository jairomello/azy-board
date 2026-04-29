import { useState, useRef, useEffect } from 'react'

interface Props {
  value: string
  onSave: (value: string) => void
  onEditStart?: () => void
  className?: string
  autoEdit?: boolean   // entra direto em modo edição (ex: modal de novo item)
  placeholder?: string
}

export function InlineEdit({ value, onSave, onEditStart, className = '', autoEdit = false, placeholder }: Props) {
  const [editing, setEditing] = useState(autoEdit)
  const [text, setText] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setText(value) }, [value])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  function save() {
    const trimmed = text.trim()
    if (trimmed && trimmed !== value) onSave(trimmed)
    else setText(value)
    setEditing(false)
  }

  function cancel() {
    setText(value)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={save}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); save() }
          if (e.key === 'Escape') { e.preventDefault(); cancel() }
        }}
        onClick={e => e.stopPropagation()}
        placeholder={placeholder}
        className={`w-full bg-transparent border-b border-primary outline-none text-sm font-medium ${className}`}
      />
    )
  }

  return (
    <p
      onDoubleClick={e => { e.stopPropagation(); onEditStart?.(); setEditing(true) }}
      onClick={e => { e.stopPropagation(); onEditStart?.(); setEditing(true) }}
      className={`cursor-text select-none text-sm font-medium leading-snug line-clamp-2 ${className} ${!value ? 'text-muted-foreground italic' : ''}`}
    >
      {value || placeholder || 'Clique para editar'}
    </p>
  )
}
