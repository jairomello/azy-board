import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  FolderKanban,
  LayoutDashboard,
  Menu,
  Settings,
  UserRound,
  X,
  Bot,
  ChevronDown,
} from 'lucide-react'
import { LanguageSelector } from './LanguageSelector'
import { ProfileDropdown } from './ProfileDropdown'
import { ThemeToggle } from './ThemeToggle'
import { Tooltip } from './ui/Tooltip'
import { BrandLogo } from './BrandLogo'
import { useAuth } from '../contexts/AuthContext'
import { canAccessAdmin, canAccessProjectSettings } from '../permissions'
import { useTranslation } from 'react-i18next'
import { useAssistant, type AssistantSelectedItem } from '../contexts/AssistantContext'
import type { AssistantScreen } from '@azy-board/types'
import { isProjectNameTruncated, truncateProjectName } from '../lib/projectName'

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
  assistantSelectedItem?: AssistantSelectedItem | null
  assistantScreen?: AssistantScreen
  assistantBoardView?: 'kanban' | 'tree'
  assistantFilters?: Record<string, string | boolean | null>
}

interface NavItem {
  label: string
  href?: string
  icon: typeof FolderKanban
  active: boolean
  children?: NavItem[]
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
  assistantSelectedItem,
  assistantScreen,
  assistantBoardView,
  assistantFilters,
}: AppShellProps) {
  const location = useLocation()
  const { user } = useAuth()
  const { setPageContext } = useAssistant()
  const { t: tCommon } = useTranslation('common')
  const { t: tDashboard } = useTranslation('dashboard')
  const { t: tAssistant } = useTranslation('assistant')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [adminExpanded, setAdminExpanded] = useState(location.pathname.startsWith('/admin'))
  const inferredScreen: AssistantScreen = location.pathname === '/projects'
    ? 'projects-index'
    : location.pathname.includes('/settings')
      ? 'project-settings'
      : location.pathname.includes('/dashboard')
        ? 'project-dashboard'
        : location.pathname.startsWith('/admin/users')
          ? 'admin-users'
          : location.pathname.startsWith('/admin/assistant')
            ? 'admin-assistant'
            : location.pathname.startsWith('/account')
              ? 'account'
              : location.pathname.includes('/board')
                ? (assistantBoardView === 'tree' ? 'project-board-tree' : 'project-board-kanban')
                : 'global-other'
  const displayTitle = projectId && projectName ? truncateProjectName(projectName) : (contextLabel ?? sectionLabel)
  const titleIsTruncated = Boolean(projectId && projectName && isProjectNameTruncated(projectName))

  useEffect(() => {
    if (projectId) localStorage.setItem('last-project-id', projectId)
  }, [projectId])

  useEffect(() => {
    setPageContext({ screen: assistantScreen ?? inferredScreen, projectId, projectName, item: assistantSelectedItem ?? null, boardView: assistantBoardView, filters: assistantFilters })
    return () => setPageContext(null)
  }, [assistantBoardView, assistantFilters, assistantScreen, assistantSelectedItem, inferredScreen, projectId, projectName, setPageContext])

  useEffect(() => setMobileOpen(false), [location.pathname])
  useEffect(() => {
    if (location.pathname.startsWith('/admin')) setAdminExpanded(true)
  }, [location.pathname])

  const effectiveProjectId = projectId ?? localStorage.getItem('last-project-id') ?? undefined
  const navItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [{
       label: tCommon('projects', { defaultValue: 'Projects' }),
      href: '/projects',
      icon: FolderKanban,
      active: location.pathname === '/projects',
    }]
    if (effectiveProjectId) {
      items.push({
        label: tCommon('board', { defaultValue: 'Board' }),
        href: `/projects/${effectiveProjectId}/board`,
        icon: LayoutDashboard,
        active: location.pathname.includes(`/projects/${effectiveProjectId}/board`),
      })
      if (canAccessProjectSettings(user?.globalGroup)) {
        items.push({
          label: tCommon('settings'),
          href: `/projects/${effectiveProjectId}/settings`,
          icon: Settings,
          active: location.pathname.includes(`/projects/${effectiveProjectId}/settings`),
        })
      }
      items.push({
        label: tDashboard('navDashboard', { defaultValue: 'Dashboard' }),
        href: `/projects/${effectiveProjectId}/dashboard`,
        icon: LayoutDashboard,
        active: location.pathname.includes(`/projects/${effectiveProjectId}/dashboard`),
      })
    }
    if (user && canAccessAdmin(user.globalGroup)) {
      items.push({
        label: tCommon('admin'),
        icon: UserRound,
        active: location.pathname.startsWith('/admin'),
        children: [
          {
            label: tCommon('users'),
            href: '/admin/users',
            icon: UserRound,
            active: location.pathname === '/admin/users',
          },
          ...(user.globalGroup === 'ROOT'
            ? [{
                label: tAssistant('tenantConfiguration', { defaultValue: 'Config. Tenant' }),
                href: '/admin/assistant',
                icon: Bot,
                active: location.pathname === '/admin/assistant',
              }]
            : []),
        ],
      })
    }
    items.push({
      label: tCommon('account'),
      href: '/account',
      icon: UserRound,
      active: location.pathname === '/account',
    })
    return items
  }, [effectiveProjectId, location.pathname, user, tCommon, tDashboard, tAssistant])

  const sidebar = (
    <div className="h-full min-h-0 flex flex-col">
      <div data-shell-sidebar-brand className="h-16 flex-shrink-0 px-3 min-[1280px]:px-4">
        <Link
          data-shell-desktop-brand
          to="/projects"
          className="h-full w-full flex items-center justify-start lg:justify-center min-[1280px]:justify-start rounded-lg text-shell-foreground"
          aria-label="AzyBoard"
        >
          <BrandLogo
            markClassName="w-10 h-10 rounded-xl bg-white/95 p-1.5 shadow-[0_6px_18px_rgba(0,0,0,0.14)]"
            wordmarkClassName="text-base lg:hidden min-[1280px]:block"
          />
        </Link>
      </div>

      <div className="min-h-0 flex-1 flex flex-col px-3 pb-4">
        <p className="mt-7 mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-shell-muted hidden min-[1280px]:block">
          {tCommon('workspace')}
        </p>
        <nav className="space-y-1 mt-4 min-[1280px]:mt-0" aria-label={tCommon('navigation')}>
        {navItems.map(item => {
          const Icon = item.icon
          const link = item.children ? (
            <button
              key={item.href ?? item.label}
              type="button"
              aria-expanded={adminExpanded}
              onClick={() => setAdminExpanded((expanded) => !expanded)}
              className={`group h-10 w-full flex items-center gap-3 px-2.5 rounded-lg transition-colors ${item.active ? 'bg-shell-active text-shell-foreground shadow-[inset_3px_0_0_var(--shell-accent)]' : 'text-shell-muted hover:text-shell-foreground hover:bg-white/10'}`}
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0" />
              <span className="text-sm font-medium hidden min-[1280px]:block">{item.label}</span>
            </button>
          ) : (
            <Link
              key={item.href}
              to={item.href!}
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
          const children =
            item.children && adminExpanded ? (
              <div className="max-lg:block lg:hidden min-[1280px]:block ml-7 mt-1 space-y-1 border-l border-shell-border pl-2">
                {item.children.map((child) => {
                  const ChildIcon = child.icon
                  if (!child.href) return null
                  return (
                    <Link
                      key={child.href}
                      to={child.href}
                      aria-current={child.active ? 'page' : undefined}
                      className={`flex h-9 items-center gap-2 rounded-lg px-2 text-xs transition-colors ${child.active ? 'bg-shell-active text-shell-foreground' : 'text-shell-muted hover:bg-white/10 hover:text-shell-foreground'}`}
                    >
                      <ChildIcon className="h-4 w-4 flex-shrink-0" />
                      <span>{child.label}</span>
                    </Link>
                  )
                })}
              </div>
            ) : null
          const itemContent = item.children ? (
            <div className="flex items-center">
              <div className="min-w-0 flex-1">{link}</div>
              <button
                type="button"
                aria-label={item.label}
                aria-expanded={adminExpanded}
                onClick={() => setAdminExpanded((expanded) => !expanded)}
                className="-ml-10 mr-1 rounded p-1 text-shell-muted hover:bg-white/10 hover:text-shell-foreground"
              >
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${adminExpanded ? 'rotate-180' : ''}`}
                />
              </button>
            </div>
          ) : (
            link
          )
          return (
            <div key={item.href} className="max-[1279px]:flex max-[1279px]:justify-center">
              <div className="min-[1280px]:hidden">
                <Tooltip label={item.label}>
                  <>{itemContent}{children}</>
                </Tooltip>
              </div>
              <div className="hidden min-[1280px]:block">
                {itemContent}
                {children}
              </div>
            </div>
          )
        })}
        </nav>

        <div className="mt-auto px-2 hidden min-[1280px]:block">
          <p className="text-xs font-medium text-shell-foreground truncate">{projectName ?? tCommon('workspace')}</p>
          <p className="text-[11px] text-shell-muted mt-0.5">{tCommon('connectedWork')}</p>
        </div>
      </div>
    </div>
  )

  return (
    <div
      data-shell-layout
      className="h-screen overflow-hidden bg-canvas text-foreground flex flex-col lg:grid lg:grid-cols-[68px_minmax(0,1fr)] min-[1280px]:grid-cols-[220px_minmax(0,1fr)] lg:grid-rows-[64px_minmax(0,1fr)] lg:p-3"
    >
      {mobileOpen && (
        <div className="fixed inset-x-0 top-[76px] bottom-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
            aria-label={tCommon('closeNavigation')}
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-3 left-3 w-[250px] rounded-2xl bg-shell-sidebar border border-shell-border shadow-2xl overflow-hidden [&_span]:!block">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 p-2 rounded-lg text-shell-muted hover:text-shell-foreground hover:bg-white/10 z-10"
               aria-label={tCommon('closeMenu')}
            >
              <X className="w-4 h-4" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <header
        data-shell-header
        className="shell-surface relative z-0 mx-3 mt-3 h-16 flex-shrink-0 rounded-2xl border border-shell-border bg-shell-header text-shell-foreground shadow-[0_10px_28px_rgba(20,35,50,0.13)] px-3 sm:px-5 flex items-center gap-3 lg:col-start-2 lg:row-start-1 lg:-ml-3 lg:mr-0 lg:mt-0 lg:pl-8 lg:rounded-l-none lg:rounded-r-2xl lg:border-l-0"
      >
        <button
          onClick={() => setMobileOpen(true)}
          className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center text-shell-muted hover:text-shell-foreground hover:bg-white/10"
           aria-label={tCommon('openMenu')}
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link
          data-shell-mobile-brand
          to="/projects"
           aria-label={`${tCommon('appName')} — ${tCommon('projects', { defaultValue: 'Projects' })}`}
          className="flex-shrink-0 text-shell-foreground lg:hidden"
        >
          <BrandLogo
            markClassName="w-9 h-9 rounded-lg bg-white/95 p-1 shadow-sm"
            wordmarkClassName="hidden xl:block text-sm"
          />
        </Link>
        <div className="hidden sm:block lg:hidden w-px h-8 bg-white/15 flex-shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] text-shell-muted">
            {projectName && <span className="truncate">{projectName}</span>}
            {projectName && <span aria-hidden>•</span>}
            <span>{sectionLabel}</span>
          </div>
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-sm sm:text-base font-semibold truncate" title={titleIsTruncated ? projectName : undefined} aria-label={titleIsTruncated ? projectName : undefined}>{displayTitle}</h1>
            {headerMeta}
          </div>
        </div>
        <div className="flex items-center gap-2 [&_.shell-control]:border-white/15 [&_.shell-control]:bg-white/10 [&_.shell-control]:text-shell-muted [&_.shell-control:hover]:text-shell-foreground">
          <div className="hidden md:block"><LanguageSelector /></div>
          <ThemeToggle />
          <ProfileDropdown />
        </div>
      </header>

      <aside
        data-shell-sidebar
        className="relative z-20 hidden lg:block lg:col-start-1 lg:row-start-1 lg:row-span-2 min-h-0 overflow-hidden rounded-2xl border border-shell-border bg-shell-sidebar shadow-[12px_0_24px_-10px_rgba(3,15,23,0.72),0_16px_40px_rgba(3,15,23,0.24)] lg:border-r-0"
      >
        {sidebar}
      </aside>

      <div data-shell-workspace className="min-h-0 min-w-0 flex-1 flex flex-col lg:col-start-2 lg:row-start-2 lg:pl-3">
        {commandBar && (
          <div className="mx-3 mt-3 flex-shrink-0 rounded-xl border border-border/80 bg-surface-floating/90 shadow-[0_8px_24px_rgba(20,35,50,0.09)] backdrop-blur-xl lg:mx-0">
            {commandBar}
          </div>
        )}

        <main className={`min-h-0 flex-1 mx-3 mt-3 lg:mx-0 ${statusRail ? 'mb-2' : 'mb-3'} ${contentClassName}`}>
          {children}
        </main>

        {statusRail && (
          <div className="mx-3 mb-3 flex-shrink-0 rounded-lg border border-border/70 bg-surface-floating/90 shadow-sm backdrop-blur-xl lg:mx-0">
            {statusRail}
          </div>
        )}
      </div>
    </div>
  )
}
