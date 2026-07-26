import { useTranslation } from 'react-i18next'
import { Moon, Sun } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from './Toast'

export function ThemeToggle() {
  const { t } = useTranslation('settings')
  const { user, updatePreferences } = useAuth()
  const { toast } = useToast()
  const dark = user?.theme === 'dark' || (!user && document.documentElement.classList.contains('dark'))

  async function toggle() {
    try {
      await updatePreferences({ theme: dark ? 'light' : 'dark' })
    } catch {
      toast(t('appearanceSaveError'), 'error')
    }
  }

  return (
    <button
      onClick={toggle}
      title={dark ? t('themeLight') : t('themeDark')}
      aria-label={dark ? t('themeLight') : t('themeDark')}
      className="shell-control w-9 h-9 rounded-lg border border-border/70 bg-background/80 hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition"
    >
      {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  )
}
