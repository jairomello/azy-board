import type { ProjectSettingsData } from './types'

export function canAccessProjectSettings(globalGroup?: string) {
  return globalGroup !== 'TEAM_MEMBER'
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
