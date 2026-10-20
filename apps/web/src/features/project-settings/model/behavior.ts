import type { MemberBatchResult, MemberRowSelection, MemberSelectionMap, ProjectSettingsData, Squad } from './types'

export function canAccessProjectSettings(globalGroup?: string) {
  return globalGroup !== 'TEAM_MEMBER'
}

// change member-batch-add-grid — helpers da grade de adição em lote.
//
// A busca passou a ser feita no servidor (a lista pode ter milhares de pessoas), então
// não há mais filtro local: o dialog só monta a página recebida e cuida da seleção.

// Squad pré-selecionado nas linhas novas: com exatamente um squad no projeto, já vem
// marcado; sem squad ou com mais de um, a linha começa sem squad e o usuário escolhe.
export function defaultSquadId(squads: Squad[]): string {
  return squads.length === 1 ? squads[0]!.id : ''
}

// Linha nova da grade: desmarcada, papel MEMBER e o squad pré-definido do projeto.
export function selectionFromRow(squadId: string): MemberRowSelection {
  return { selected: false, role: 'MEMBER', squadId }
}

// Alterna a marcação de uma pessoa preservando papel/squad e as demais linhas.
export function toggleSelection(
  selection: MemberSelectionMap,
  userId: string,
  rowDefaultSquadId: string,
): MemberSelectionMap {
  const current = selection[userId] ?? selectionFromRow(rowDefaultSquadId)
  return { ...selection, [userId]: { ...current, selected: !current.selected } }
}

// Papel/squad escolhidos em uma linha; a marcação é preservada.
export function updateRowSelection(
  selection: MemberSelectionMap,
  userId: string,
  patch: Partial<Pick<MemberRowSelection, 'role' | 'squadId'>>,
  rowDefaultSquadId: string,
): MemberSelectionMap {
  const current = selection[userId] ?? selectionFromRow(rowDefaultSquadId)
  return { ...selection, [userId]: { ...current, ...patch } }
}

// Quantas pessoas estão marcadas — inclusive as que não estão na página visível.
export function selectedMemberCount(selection: MemberSelectionMap): number {
  return Object.values(selection).filter(row => row.selected).length
}

// Corpo enviado à adição em lote, na ordem em que as pessoas foram marcadas.
export function selectionPayload(selection: MemberSelectionMap): Array<{ userId: string; role: string; squadId: string | null }> {
  return Object.entries(selection)
    .filter(([, row]) => row.selected)
    .map(([userId, row]) => ({ userId, role: row.role, squadId: row.squadId || null }))
}

export type MemberGridState = 'loading' | 'error' | 'empty' | 'ready'

// Estado observável da grade. Erro vence carregamento; `empty` vale quando não há
// nenhuma linha carregada para o termo informado.
export function memberGridState(input: { loading: boolean; hasError: boolean; hasRows: boolean }): MemberGridState {
  if (input.hasError) return 'error'
  if (input.loading) return 'loading'
  return input.hasRows ? 'ready' : 'empty'
}

// Resumo do resultado da adição em lote (criados / já membros / inválidos), com as
// partes zeradas omitidas.
export function batchSummaryMessage(
  result: MemberBatchResult,
  t: (key: string, options?: { count: number }) => string,
): string {
  const parts: string[] = []
  if (result.created.length > 0) parts.push(t('settings:memberBatchCreated', { count: result.created.length }))
  if (result.skipped.length > 0) parts.push(t('settings:memberBatchSkipped', { count: result.skipped.length }))
  if (result.invalid.length > 0) parts.push(t('settings:memberBatchInvalid', { count: result.invalid.length }))
  return parts.length > 0 ? parts.join(' ') : t('settings:memberBatchNothing')
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
