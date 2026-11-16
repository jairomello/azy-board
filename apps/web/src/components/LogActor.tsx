import { Bot, CircleHelp, Settings, User } from 'lucide-react'
import type { ReactNode } from 'react'
import { displayPersonName } from '../lib/personName'

export type LogActorKind = 'HUMAN' | 'AGENT' | 'SYSTEM' | 'UNKNOWN'
export type LogActorSource = 'REST' | 'MCP' | 'SYSTEM' | 'UNKNOWN'

export interface LogActorEntry {
  actorType?: LogActorKind
  actorLabel?: string | null
  source?: LogActorSource
  author?: { id: string; name: string; avatarUrl: string | null } | null
}

export interface LogActorLabels {
  agent: string
  human: string
  system: string
  unknown: string
  unidentifiedAuthor: string
}

function actorKind(entry: LogActorEntry): LogActorKind {
  if (entry.actorType === 'AGENT' || entry.source === 'MCP') return 'AGENT'
  if (entry.actorType === 'SYSTEM' || entry.source === 'SYSTEM') return 'SYSTEM'
  return entry.actorType === 'HUMAN' ? 'HUMAN' : 'UNKNOWN'
}

// [B20] Identidade do autor de um registro de histórico ou diário.
//
// Pessoa identificada aparece como menção `@Nome` (duas partes, T76) com o nome
// completo no tooltip. Agente aparece pelo rótulo da automação, sem menção — a
// menção é de pessoa. Sem nome resolvido, o painel diz "Autor não identificado"
// em vez de usar o tipo do executor como se fosse nome.
export function LogActor({ entry, labels, timestamp }: { entry: LogActorEntry; labels: LogActorLabels; timestamp?: string }) {
  const kind = actorKind(entry)
  const personName = entry.author?.name?.trim() || null
  const toolName = entry.actorLabel?.trim() || null
  const Icon = kind === 'AGENT' ? Bot : kind === 'SYSTEM' ? Settings : kind === 'HUMAN' ? User : CircleHelp
  const badge = kind === 'AGENT' ? labels.agent : kind === 'SYSTEM' ? labels.system : kind === 'HUMAN' ? labels.human : labels.unknown

  let identity: ReactNode
  if (kind === 'SYSTEM') {
    identity = <span className="truncate text-xs font-medium text-foreground">{labels.system}</span>
  } else if (kind === 'AGENT') {
    // Automação nunca vira menção de pessoa: o rótulo do agente é a identidade.
    identity = toolName
      ? <span className="truncate text-xs font-medium text-foreground" title={toolName}>{toolName}</span>
      : <span className="truncate text-xs italic text-muted-foreground">{labels.unidentifiedAuthor}</span>
  } else if (personName) {
    identity = (
      <span className="truncate rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary" title={personName}>
        @{displayPersonName(personName)}
      </span>
    )
  } else {
    identity = <span className="truncate text-xs italic text-muted-foreground">{labels.unidentifiedAuthor}</span>
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Icon className={`h-3.5 w-3.5 shrink-0 ${kind === 'AGENT' ? 'text-violet-500' : 'text-primary'}`} aria-hidden="true" />
      {identity}
      {kind !== 'SYSTEM' && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">{badge}</span>}
      {timestamp && <span className="shrink-0 text-[10px] text-muted-foreground">{timestamp}</span>}
    </div>
  )
}

export function logActorLabels(t: (key: string) => string): LogActorLabels {
  return {
    agent: t('accordion.agent'),
    human: t('accordion.human'),
    system: t('accordion.system'),
    unknown: t('accordion.unknown'),
    unidentifiedAuthor: t('accordion.unidentifiedAuthor'),
  }
}
