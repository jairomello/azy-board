import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  FolderKanban,
  LayoutDashboard,
  Menu,
  Settings,
  UserRound,
  X,
} from 'lucide-react'
import { LanguageSelector } from './LanguageSelector'
import { ProfileDropdown } from './ProfileDropdown'
import { ThemeToggle } from './ThemeToggle'
import { Tooltip } from './ui/Tooltip'
import { BrandLogo } from './BrandLogo'

interface AppShellProps {
  children: ReactNode
  projectId?: string
  projectName?: string
  sectionLabel: string
  contextLabel?: string
  headerMeta?: ReactNode
  commandBar?: ReactNode
  statusRail?: ReactNode
  contentClassName?: string
}

interface NavItem {
  label: string
  href: string
  icon: typeof FolderKanban
  active: boolean
}

export function AppShell({
  children,
  projectId,
  projectName,
  sectionLabel,
  contextLabel,
  headerMeta,
  commandBar,
  statusRail,
  contentClassName = '',
}: AppShellProps) {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (projectId) localStorage.setItem('last-project-id', projectId)
  }, [projectId])

  useEffect(() => setMobileOpen(false), [location.pathname])

  const effectiveProjectId = projectId ?? localStorage.getItem('last-project-id') ?? undefined
  const navItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [{
      label: 'Projetos',
      href: '/projects',
      icon: FolderKanban,
      active: location.pathname === '/projects',
    }]
    if (effectiveProjectId) {
      items.push({
        label: 'Board',
        href: `/projects/${effectiveProjectId}/board`,
        icon: LayoutDashboard,
        active: location.pathname.includes(`/projects/${effectiveProjectId}/board`),
      })
      items.push({
        label: 'Configurações',
        href: `/projects/${effectiveProjectId}/settings`,
        icon: Settings,
        active: location.pathname.includes(`/projects/${effectiveProjectId}/settings`),
      })
    }
    items.push({
      label: 'Conta',
      href: '/account',
      icon: UserRound,
      active: location.pathname === '/account',
    })
    return items
  }, [effectiveProjectId, location.pathname])

  const sidebar = (
    <div className="h-full flex flex-col px-3 py-4">
      <Link
        to="/projects"
        className="h-11 flex items-center gap-3 px-2 rounded-lg text-shell-foreground"
        aria-label="AzyBoard"
      >
        <BrandLogo
          markClassName="w-8 h-8 rounded-lg bg-white/95 p-1 shadow-sm"
          wordmarkClassName="text-[15px] hidden min-[1280px]:block"
        />
      </Link>

      <p className="mt-7 mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-shell-muted hidden min-[1280px]:block">
        Workspace
      </p>
      <nav className="space-y-1 mt-4 min-[1280px]:mt-0" aria-label="Navegação principal">
        {navItems.map(item => {
          const Icon = item.icon
          const link = (
            <Link
              key={item.href}
              to={item.href}
              aria-current={item.active ? 'page' : undefined}
              className={`group h-10 flex items-center gap-3 px-2.5 rounded-lg transition-colors ${
                item.active
                  ? 'bg-shell-active text-shell-foreground shadow-[inset_3px_0_0_var(--shell-accent)]'
                  : 'text-shell-muted hover:text-shell-foreground hover:bg-white/10'
              }`}
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0" />
              <span className="text-sm font-medium hidden min-[1280px]:block">{item.label}</span>
            </Link>
          )
          return (
            <div key={item.href} className="max-[1279px]:flex max-[1279px]:justify-center">
              <div className="min-[1280px]:hidden">
                <Tooltip label={item.label}>{link}</Tooltip>
              </div>
              <div className="hidden min-[1280px]:block">{link}</div>
            </div>
          )
        })}
      </nav>

      <div className="mt-auto px-2 hidden min-[1280px]:block">
        <p className="text-xs font-medium text-shell-foreground truncate">{projectName ?? 'Seu workspace'}</p>
        <p className="text-[11px] text-shell-muted mt-0.5">Trabalho conectado</p>
      </div>
    </div>
  )

  return (
    <div className="h-screen overflow-hidden bg-canvas text-foreground flex flex-col">
      {mobileOpen && (
        <div className="fixed inset-x-0 top-[76px] bottom-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
            aria-label="Fechar navegação"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-3 left-3 w-[250px] rounded-2xl bg-shell-sidebar border border-shell-border shadow-2xl overflow-hidden [&_span]:!block">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 p-2 rounded-lg text-shell-muted hover:text-shell-foreground hover:bg-white/10 z-10"
              aria-label="Fechar menu"
            >
              <X className="w-4 h-4" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <header className="shell-surface mx-3 mt-3 h-16 flex-shrink-0 rounded-2xl border border-shell-border bg-shell-header text-shell-foreground shadow-[0_10px_28px_rgba(20,35,50,0.13)] px-3 sm:px-5 flex items-center gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center text-shell-muted hover:text-shell-foreground hover:bg-white/10"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link
          to="/projects"
          aria-label="AzyBoard — Projetos"
          className="flex-shrink-0 text-shell-foreground"
        >
          <BrandLogo
            markClassName="w-9 h-9 rounded-lg bg-white/95 p-1 shadow-sm"
            wordmarkClassName="hidden xl:block text-sm"
          />
        </Link>
        <div className="hidden sm:block w-px h-8 bg-white/15 flex-shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] text-shell-muted">
            {projectName && <span className="truncate">{projectName}</span>}
            {projectName && <span aria-hidden>•</span>}
            <span>{sectionLabel}</span>
          </div>
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-sm sm:text-base font-semibold truncate">{contextLabel ?? sectionLabel}</h1>
            {headerMeta}
          </div>
        </div>
        <div className="flex items-center gap-2 [&_.shell-control]:border-white/15 [&_.shell-control]:bg-white/10 [&_.shell-control]:text-shell-muted [&_.shell-control:hover]:text-shell-foreground">
          <div className="hidden md:block"><LanguageSelector /></div>
          <ThemeToggle />
          <ProfileDropdown />
        </div>
      </header>

      <div className="min-h-0 flex-1 flex">
        <aside className="hidden lg:block flex-shrink-0 ml-3 mt-3 mb-3 w-[68px] min-[1280px]:w-[220px] rounded-2xl bg-shell-sidebar border border-shell-border shadow-[0_16px_40px_rgba(20,35,50,0.18)] overflow-hidden">
          {sidebar}
        </aside>

        <div className="min-w-0 flex-1 flex flex-col">
          {commandBar && (
            <div className="mx-3 mt-3 flex-shrink-0 rounded-xl border border-border/80 bg-surface-floating/90 shadow-[0_8px_24px_rgba(20,35,50,0.09)] backdrop-blur-xl">
              {commandBar}
            </div>
          )}

          <main className={`min-h-0 flex-1 mx-3 mt-3 ${statusRail ? 'mb-2' : 'mb-3'} ${contentClassName}`}>
            {children}
          </main>

          {statusRail && (
            <div className="mx-3 mb-3 flex-shrink-0 rounded-lg border border-border/70 bg-surface-floating/90 shadow-sm backdrop-blur-xl">
              {statusRail}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
