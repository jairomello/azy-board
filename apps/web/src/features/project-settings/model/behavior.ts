import type { MemberCandidate, ProjectSettingsData } from './types'

export function canAccessProjectSettings(globalGroup?: string) {
  return globalGroup !== 'TEAM_MEMBER'
}

// Busca do seletor de membros: casa nome ou e-mail, sem diferenciar maiúsculas.
export function filterMemberCandidates(candidates: MemberCandidate[], term: string): MemberCandidate[] {
  const normalized = term.trim().toLocaleLowerCase('pt-BR')
  if (!normalized) return candidates
  return candidates.filter(candidate =>
    candidate.name.toLocaleLowerCase('pt-BR').includes(normalized) ||
    candidate.email.toLocaleLowerCase('pt-BR').includes(normalized))
}

export type MemberCandidateState = 'loading' | 'error' | 'empty' | 'ready'

// Estado observável do seletor. Erro vence carregamento; `empty` vale quando não
// sobrou candidato selecionável para o termo informado (ex.: todos já são membros).
export function memberCandidateState(input: { loading: boolean; hasError: boolean; visible: MemberCandidate[] }): MemberCandidateState {
  if (input.hasError) return 'error'
  if (input.loading) return 'loading'
  return input.visible.some(candidate => !candidate.isMember) ? 'ready' : 'empty'
}

export function updateSettingsField<K extends keyof ProjectSettingsData>(data: ProjectSettingsData, field: K, value: ProjectSettingsData[K]) {
  return { ...data, [field]: value }
}

// Executa uma exclusão e só aplica o estado local em caso de sucesso.
// Em falha, comunica o erro e preserva o estado (a UI não remove o item indevidamente).
export async function runDeleteMutation(options: {
  execute: () => Promise<unknown>
  onSuccess: () => void
  onError: (error: unknown) => void
}): Promise<boolean> {
  try {
    await options.execute()
    options.onSuccess()
    return true
  } catch (error) {
    options.onError(error)
    return false
  }
}

export async function runSettingsMutation<T>(options: {
  execute: () => Promise<T>
  onStart: () => void
  onSuccess?: (value: T) => void
  onError: (error: unknown) => void
  onFinally: () => void
}) {
  options.onStart()
  try {
    const value = await options.execute()
    options.onSuccess?.(value)
    return value
  } catch (error) {
    options.onError(error)
    throw error
  } finally {
    options.onFinally()
  }
}
