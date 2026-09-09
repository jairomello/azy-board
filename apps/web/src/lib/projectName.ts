export const PROJECT_NAME_MAX_LENGTH = 60

export function truncateProjectName(name: string, maxLength = PROJECT_NAME_MAX_LENGTH): string {
  const characters = Array.from(name)
  if (characters.length <= maxLength) return name
  return `${characters.slice(0, Math.max(0, maxLength - 3)).join('')}...`
}

export function isProjectNameTruncated(name: string, maxLength = PROJECT_NAME_MAX_LENGTH): boolean {
  return Array.from(name).length > maxLength
}
