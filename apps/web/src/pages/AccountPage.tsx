import { useTranslation } from 'react-i18next'
import { Check, Palette, User, EyeOff, Clock } from 'lucide-react'
import type { LightShellTheme, Theme } from '@azy-board/types'
import { useAuth } from '../contexts/AuthContext'
import { ApiKeysSection } from '../components/ApiKeysSection'
import { ShowHiddenProjectsSwitch } from '../components/ShowHiddenProjectsSwitch'
import { useToast } from '../components/Toast'
import { AppShell } from '../components/AppShell'

const SHELL_THEMES: Array<{
  id: LightShellTheme
  sidebar: string
  header: string
  accent: string
}> = [
  { id: 'petroleum', sidebar: '#0B4651', header: '#0E4B56', accent: '#50E3C2' },
  { id: 'ocean', sidebar: '#123B67', header: '#164777', accent: '#67C7FF' },
  { id: 'emerald', sidebar: '#125244', header: '#146052', accent: '#69E0B5' },
  { id: 'graphite', sidebar: '#272B31', header: '#30353C', accent: '#A99FFF' },
  { id: 'classic', sidebar: '#FFFFFF', header: '#FFFFFF', accent: '#635BFF' },
]

export default function AccountPage() {
  const { t } = useTranslation('settings')
  const { user, updatePreferences } = useAuth()
  const { toast } = useToast()
  const selectedTheme = user?.lightShellTheme ?? 'petroleum'

  async function savePreference(preference: { theme?: Theme; lightShellTheme?: LightShellTheme; autoThemeByTime?: boolean }) {
    try {
      await updatePreferences(preference)
      toast(t('appearanceSaved'))
    } catch {
      toast(t('appearanceSaveError'), 'error')
    }
  }

  function handleThemeKeys(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
    event.preventDefault()
    const currentIndex = SHELL_THEMES.findIndex(theme => theme.id === selectedTheme)
    const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1
    const next = SHELL_THEMES[(currentIndex + direction + SHELL_THEMES.length) % SHELL_THEMES.length]
    if (next) void savePreference({ lightShellTheme: next.id })
  }

  return (
    <AppShell sectionLabel={t('account')} contextLabel={t('accountPreferences')} contentClassName="overflow-y-auto">
      <div className="max-w-3xl mx-auto py-5 sm:py-8">
        <div className="mb-7">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{t('account')}</p>
          <h2 className="text-2xl font-bold text-foreground mt-1">{t('accountPreferences')}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t('accountPreferencesDescription')}</p>
        </div>

        {/* Perfil do usuário */}
        <section className="flex items-center gap-4 bg-card border border-border rounded-xl px-5 py-4 mb-5 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <User className="w-6 h-6 text-primary" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">{user?.name}</p>
            <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
          </div>
        </section>

        <section className="bg-card border border-border rounded-xl px-5 py-5 mb-5 shadow-sm">
          <div className="flex items-start gap-3 mb-5">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Palette className="w-[18px] h-[18px]" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{t('appearance')}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{t('appearanceDescription')}</p>
            </div>
          </div>

          <div className="mb-5">
            <p className="text-xs font-semibold text-foreground mb-2">{t('colorMode')}</p>
            <div className="inline-flex rounded-lg bg-muted p-1" role="group" aria-label={t('colorMode')}>
              {(['light', 'dark'] as Theme[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => savePreference({ theme: mode })}
                  aria-pressed={user?.theme === mode}
                  disabled={user?.autoThemeByTime === true}
                  className={`px-4 py-2 rounded-md text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${
                    user?.theme === mode ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {mode === 'light' ? t('themeLight') : t('themeDark')}
                </button>
              ))}
            </div>
            {user?.autoThemeByTime === true && (
              <p className="text-[11px] text-muted-foreground mt-2">{t('autoThemeByTimeManualDisabled')}</p>
            )}
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={user?.autoThemeByTime === true}
            onClick={() => savePreference({ autoThemeByTime: !(user?.autoThemeByTime === true) })}
            className="flex items-center justify-between gap-3 w-full px-3 py-2 mb-5 text-sm text-foreground border border-border hover:bg-muted transition-colors rounded-lg text-left"
          >
            <span className="flex items-center gap-2 min-w-0">
              <Clock className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <span className="flex flex-col">
                <span>{t('autoThemeByTime')}</span>
                <span className="text-[11px] font-normal text-muted-foreground">{t('autoThemeByTimeHint')}</span>
              </span>
            </span>
            <span
              aria-hidden="true"
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                user?.autoThemeByTime === true ? 'bg-primary' : 'bg-muted-foreground/30'
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-all ${
                  user?.autoThemeByTime === true ? 'left-[1.125rem]' : 'left-0.5'
                }`}
              />
            </span>
          </button>

          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="text-xs font-semibold text-foreground">{t('lightShellTheme')}</p>
              {user?.theme === 'dark' && (
                <span className="text-[11px] text-muted-foreground">{t('lightThemeDarkHint')}</span>
              )}
            </div>
            <div
              role="radiogroup"
              aria-label={t('lightShellTheme')}
              onKeyDown={handleThemeKeys}
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5"
            >
              {SHELL_THEMES.map(theme => {
                const selected = selectedTheme === theme.id
                return (
                  <button
                    key={theme.id}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => savePreference({ lightShellTheme: theme.id })}
                    className={`relative rounded-lg border p-2 text-left transition ${
                      selected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <span className="h-12 rounded-md overflow-hidden flex border border-black/10 mb-2">
                      <span className="w-[30%] h-full" style={{ backgroundColor: theme.sidebar }} />
                      <span className="flex-1 h-full bg-[#eef2f6]">
                        <span className="block h-[34%]" style={{ backgroundColor: theme.header }} />
                        <span className="block w-1/2 h-1 rounded-full mt-2 ml-2" style={{ backgroundColor: theme.accent }} />
                      </span>
                    </span>
                    <span className="block text-[11px] font-semibold text-foreground truncate">
                      {t(`shellThemes.${theme.id}`)}
                    </span>
                    {selected && (
                      <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        <section className="bg-card border border-border rounded-xl px-5 py-5 mb-5 shadow-sm">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <EyeOff className="w-[18px] h-[18px]" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{t('projectVisibility')}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{t('projectVisibilityDescription')}</p>
            </div>
          </div>
          <ShowHiddenProjectsSwitch />
          <p className="text-xs text-muted-foreground mt-2">{t('showHiddenProjectsHint')}</p>
        </section>

        {/* Seção de API Keys */}
        <div className="bg-card border border-border rounded-xl px-5 py-5 shadow-sm">
          <ApiKeysSection />
        </div>
      </div>
    </AppShell>
  )
}
