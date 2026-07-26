import { useTranslation } from 'react-i18next'
import type { Language } from '@azy-board/types'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from './Toast'

const LANGS = [
  { code: 'pt-BR', label: 'PT' },
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
]

export function LanguageSelector() {
  const { i18n, t } = useTranslation('settings')
  const { updatePreferences } = useAuth()
  const { toast } = useToast()
  const current = i18n.language

  async function change(lang: Language) {
    try {
      await updatePreferences({ language: lang })
    } catch {
      toast(t('appearanceSaveError'), 'error')
    }
  }

  return (
    <div className="flex items-center gap-1">
      {LANGS.map(l => (
        <button
          key={l.code}
          onClick={() => change(l.code as Language)}
          className={`shell-control px-2 py-1 text-xs font-medium rounded-md transition ${
            current === l.code
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}
