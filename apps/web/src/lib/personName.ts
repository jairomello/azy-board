/** Limite de caracteres do nome exibido, incluindo as reticências do corte. */
export const PERSON_NAME_MAX_LENGTH = 15

/**
 * Nome de pessoa pronto para exibição em superfícies de leitura.
 *
 * Reduz o nome a duas partes — a primeira e a última — e limita o resultado a
 * `maxLength` caracteres, cortando com reticências quando exceder. O nome completo
 * continua disponível para `title`/`aria-label`, onde a identificação precisa ser exata.
 */
export function displayPersonName(name: string, maxLength = PERSON_NAME_MAX_LENGTH): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  const reduced = parts.length <= 2 ? parts.join(' ') : `${parts[0]} ${parts[parts.length - 1]}`
  if (reduced.length <= maxLength) return reduced
  const limit = Math.max(1, maxLength - 1)
  return `${reduced.slice(0, limit).trimEnd()}…`
}
