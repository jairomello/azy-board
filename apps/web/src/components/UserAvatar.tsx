interface AvatarUser {
  name: string
  avatarUrl?: string | null
  aiModelName?: string | null
}

const COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
  'bg-amber-500', 'bg-rose-500', 'bg-cyan-500',
]

function getColor(name: string) {
  let hash = 0
  for (const c of name) hash = (hash << 5) - hash + c.charCodeAt(0)
  return COLORS[Math.abs(hash) % COLORS.length]!
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

interface Props {
  user: AvatarUser
  size?: 'xs' | 'sm' | 'md'
  showAiBadge?: boolean
}

const sizes = { xs: 'w-6 h-6 text-xs', sm: 'w-8 h-8 text-sm', md: 'w-10 h-10 text-base' }

export function UserAvatar({ user, size = 'md', showAiBadge }: Props) {
  const sizeClass = sizes[size]

  return (
    <div className="relative inline-flex">
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={user.name}
          className={`${sizeClass} rounded-full object-cover ring-2 ring-background`}
        />
      ) : (
        <div className={`${sizeClass} rounded-full ${getColor(user.name)} flex items-center justify-center text-white font-semibold ring-2 ring-background`}>
          {getInitials(user.name)}
        </div>
      )}

      {/* Badge de IA — mostrado quando o responsável é um agente */}
      {showAiBadge && user.aiModelName && (
        <div
          className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-violet-600 border-2 border-background flex items-center justify-center"
          title={`Agente IA: ${user.aiModelName}`}
        >
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
          </svg>
        </div>
      )}
    </div>
  )
}
