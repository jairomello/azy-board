import type { LogLevel, LogFormat, ObservabilityConfig } from '../config/observability'

export interface LogEntry {
  ts: string
  level: LogLevel
  msg: string
  requestId?: string
  method?: string
  route?: string
  status?: number
  durationMs?: number
  tenant?: string
  [key: string]: unknown
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const REDACTED_KEYS = /password|secret|token|authorization|cookie|api[_-]?key|stack|sql|query/i
const REDACTED_VALUES = /password|secret|token|bearer|sqlite|postgres| at \//i

export function redactSensitive(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') {
    if (REDACTED_VALUES.test(value)) return '[REDACTED]'
    return value
  }
  if (Array.isArray(value)) return value.map(redactSensitive)
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (REDACTED_KEYS.test(key)) {
        result[key] = '[REDACTED]'
      } else {
        result[key] = redactSensitive(item)
      }
    }
    return result
  }
  return value
}

function formatPretty(entry: LogEntry): string {
  const { ts, level, msg, requestId, method, route, status, durationMs, tenant, ...rest } = entry
  const prefix = `[${ts}] ${level.toUpperCase().padEnd(5)}`
  const context = [
    requestId && `rid=${requestId}`,
    method && `${method} ${route}`,
    status && `status=${status}`,
    durationMs != null && `${durationMs}ms`,
    tenant && `tenant=${tenant}`,
  ].filter(Boolean).join(' ')
  const extra = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : ''
  return `${prefix} ${context ? `[${context}] ` : ''}${msg}${extra}`
}

function formatJson(entry: LogEntry): string {
  return JSON.stringify(entry)
}

let currentLevel: LogLevel = 'info'
let currentFormat: LogFormat = 'json'

export function configureLogger(config: ObservabilityConfig): void {
  currentLevel = config.logLevel
  currentFormat = config.logFormat
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel]
}

function emit(level: LogLevel, msg: string, data?: Record<string, unknown>): void {
  if (!shouldLog(level)) return
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...redactSensitive(data ?? {}) as Record<string, unknown>,
  }
  const output = currentFormat === 'pretty' ? formatPretty(entry) : formatJson(entry)
  if (level === 'error') {
    process.stderr.write(output + '\n')
  } else {
    process.stdout.write(output + '\n')
  }
}

export const logger = {
  debug: (msg: string, data?: Record<string, unknown>) => emit('debug', msg, data),
  info: (msg: string, data?: Record<string, unknown>) => emit('info', msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => emit('warn', msg, data),
  error: (msg: string, data?: Record<string, unknown>) => emit('error', msg, data),
}