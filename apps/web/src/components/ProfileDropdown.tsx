import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Settings, LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { UserAvatar } from './UserAvatar'

export function ProfileDropdown() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        aria-label={t('settings:accountSettings')}
      >
        <UserAvatar user={user!} size="sm" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 rounded-lg border border-border bg-card shadow-lg z-50 py-1">
          <button
            onClick={() => { setOpen(false); navigate('/account') }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
          >
            <Settings className="w-4 h-4 text-muted-foreground" />
            {t('settings:accountSettings')}
          </button>
          <div className="my-1 border-t border-border" />
          <button
            onClick={() => { setOpen(false); logout() }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
          >
            <LogOut className="w-4 h-4 text-muted-foreground" />
            {t('auth:logout')}
          </button>
        </div>
      )}
    </div>
  )
}
