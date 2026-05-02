import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, User } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { ApiKeysSection } from '../components/ApiKeysSection'
import { ThemeToggle } from '../components/ThemeToggle'
import { LanguageSelector } from '../components/LanguageSelector'

export default function AccountPage() {
  const { t } = useTranslation('settings')
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/projects"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Projetos
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSelector />
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-foreground mb-8">{t('account')}</h1>

        {/* Perfil do usuário */}
        <section className="flex items-center gap-4 bg-card border border-border rounded-xl px-5 py-4 mb-8">
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

        {/* Seção de API Keys */}
        <div className="bg-card border border-border rounded-xl px-5 py-5">
          <ApiKeysSection />
        </div>
      </main>
    </div>
  )
}
