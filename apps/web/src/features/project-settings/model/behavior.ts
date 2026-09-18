import type { ProjectSettingsData } from './types'

export function canAccessProjectSettings(globalGroup?: string) {
  return globalGroup !== 'TEAM_MEMBER'
}

export function updateSettingsField<K extends keyof ProjectSettingsData>(data: ProjectSettingsData, field: K, value: ProjectSettingsData[K]) {
  return { ...data, [field]: value }
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
