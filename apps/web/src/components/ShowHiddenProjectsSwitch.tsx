import { useTranslation } from 'react-i18next'
import { Eye } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

// Controle único da preferência de sessão "mostrar projetos ocultos",
// usado tanto no dropdown do avatar quanto na página de conta.
export function ShowHiddenProjectsSwitch({ labelKey = 'showHiddenProjects' }: { labelKey?: string }) {
  const { t } = useTranslation('settings')
  const { showHiddenProjects, setShowHiddenProjects } = useAuth()

  return (
    <button
      type="button"
      role="switch"
      aria-checked={showHiddenProjects}
      onClick={() => setShowHiddenProjects(!showHiddenProjects)}
      className="flex items-center justify-between gap-3 w-full px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors rounded-lg"
    >
      <span className="flex items-center gap-2">
        <Eye className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
        {t(labelKey)}
      </span>
      <span
        aria-hidden="true"
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          showHiddenProjects ? 'bg-primary' : 'bg-muted-foreground/30'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-all ${
            showHiddenProjects ? 'left-[1.125rem]' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  )
}
