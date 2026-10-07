const SHA_PATTERN = /^[0-9a-f]{40}$/i
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const STATUSES = new Set(['VERIFICADO', 'LIMITADO', 'PENDENTE', 'NAO_COMPROVADO'])

export function validateReleaseEvidenceManifest(value: unknown): string[] {
  const problems: string[] = []
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['manifesto deve ser um objeto JSON']

  const manifest = value as Record<string, unknown>
  if (manifest.schemaVersion !== 1) problems.push('schemaVersion deve ser 1')
  if (typeof manifest.observedAt !== 'string' || !DATE_PATTERN.test(manifest.observedAt)) {
    problems.push('observedAt deve usar o formato AAAA-MM-DD')
  }
  if (typeof manifest.sourceSha !== 'string' || !SHA_PATTERN.test(manifest.sourceSha)) {
    problems.push('sourceSha deve ser um SHA completo de 40 caracteres')
  }
  if (manifest.workingTree !== 'CLEAN' && manifest.workingTree !== 'DIRTY') {
    problems.push('workingTree deve ser CLEAN ou DIRTY')
  }
  if (!Array.isArray(manifest.gates) || manifest.gates.length === 0) {
    problems.push('gates deve conter ao menos uma evidência')
    return problems
  }

  for (const [index, entryValue] of manifest.gates.entries()) {
    const label = `gates[${index}]`
    if (!entryValue || typeof entryValue !== 'object' || Array.isArray(entryValue)) {
      problems.push(`${label} deve ser um objeto`)
      continue
    }
    const entry = entryValue as Record<string, unknown>
    for (const field of ['id', 'name', 'command', 'evidence', 'sha', 'date', 'note']) {
      if (typeof entry[field] !== 'string' || entry[field].trim() === '') problems.push(`${label}.${field} é obrigatório`)
    }
    if (typeof entry.status !== 'string' || !STATUSES.has(entry.status)) {
      problems.push(`${label}.status deve ser VERIFICADO, LIMITADO, PENDENTE ou NAO_COMPROVADO`)
    }
    if (typeof entry.sha === 'string' && !SHA_PATTERN.test(entry.sha)) problems.push(`${label}.sha deve ser um SHA completo de 40 caracteres`)
    if (typeof entry.date === 'string' && !DATE_PATTERN.test(entry.date)) problems.push(`${label}.date deve usar o formato AAAA-MM-DD`)
    if (entry.status === 'VERIFICADO' && manifest.workingTree === 'DIRTY') {
      problems.push(`${label}: não pode declarar VERIFICADO quando a working tree está DIRTY`)
    }
    if (entry.status === 'NAO_COMPROVADO' && typeof entry.note === 'string' && !/não comprov|nao comprov|not proven/i.test(entry.note)) {
      problems.push(`${label}: NAO_COMPROVADO deve explicar a prova indisponível`)
    }
  }

  return problems
}
