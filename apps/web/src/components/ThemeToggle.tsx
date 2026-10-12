import { useTranslation } from 'react-i18next'
import { Moon, Sun, SunMoon } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from './Toast'
import { Tooltip } from './ui/Tooltip'

export function ThemeToggle() {
  const { t } = useTranslation('settings')
  const { user, updatePreferences } = useAuth()
  const { toast } = useToast()
  const dark = user?.theme === 'dark' || (!user && document.documentElement.classList.contains('dark'))
  const auto = user?.autoThemeByTime === true

  async function toggle() {
    if (auto) return
    try {
      await updatePreferences({ theme: dark ? 'light' : 'dark' })
    } catch {
      toast(t('appearanceSaveError'), 'error')
    }
  }

  const manualLabel = dark ? t('themeLight') : t('themeDark')
  const label = auto ? t('themeAutoToggleDisabled') : manualLabel

  const button = (
    <button
      onClick={toggle}
      disabled={auto}
      title={auto ? undefined : manualLabel}
      aria-label={label}
      aria-disabled={auto}
      className="shell-control w-9 h-9 rounded-lg border border-border/70 bg-background/80 hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-background/80 disabled:hover:text-muted-foreground"
    >
      {auto ? (
        <SunMoon className="w-4 h-4" />
      ) : dark ? (
        <Sun className="w-4 h-4" />
      ) : (
        <Moon className="w-4 h-4" />
      )}
    </button>
  )

  return auto ? <Tooltip label={label}>{button}</Tooltip> : button
}
