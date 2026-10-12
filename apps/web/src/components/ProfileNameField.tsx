import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from './Toast'

// Card T54 — edição do nome de exibição na página de conta. O e-mail (login)
// permanece somente leitura e imutável por este fluxo.
export function ProfileNameField() {
  const { t } = useTranslation('settings')
  const { user, updateName } = useAuth()
  const { toast } = useToast()
  const [name, setName] = useState(user?.name ?? '')
  const [savingName, setSavingName] = useState(false)

  useEffect(() => {
    setName(user?.name ?? '')
  }, [user?.name])

  async function handleSaveName(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length === 0 || trimmed.length > 200) {
      toast(t('accountNameInvalid'), 'error')
      return
    }
    if (trimmed === user?.name) return
    setSavingName(true)
    try {
      await updateName(trimmed)
      setName(trimmed)
      toast(t('accountNameSaved'))
    } catch {
      toast(t('accountNameError'), 'error')
    } finally {
      setSavingName(false)
    }
  }

  return (
    <form onSubmit={(event) => void handleSaveName(event)} className="min-w-0 flex-1">
      <label htmlFor="account-name" className="block text-xs font-semibold text-foreground mb-1">
        {t('accountNameLabel')}
      </label>
      <div className="flex gap-2">
        <input
          id="account-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={200}
          className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
        />
        <button
          type="submit"
          disabled={savingName}
          className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border border-border text-foreground hover:bg-muted transition disabled:opacity-50"
        >
          {savingName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('accountNameSave')}
        </button>
      </div>
      <p className="text-sm text-muted-foreground truncate mt-1">{user?.email}</p>
    </form>
  )
}
