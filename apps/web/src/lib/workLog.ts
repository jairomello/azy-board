export function parseWorkDuration(value: string): number | null {
  const match = value.trim().match(/^(\d+):(\d{2})$/)
  if (!match) return null
  const minutes = Number(match[2])
  if (minutes > 59) return null
  return Number(match[1]) * 60 + minutes
}

export function formatWorkDuration(durationMin: number): string {
  const hours = Math.floor(durationMin / 60)
  const minutes = durationMin % 60
  return `${hours}:${String(minutes).padStart(2, '0')}`
}
