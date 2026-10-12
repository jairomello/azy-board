// [T58] Datas automáticas pela sprint na criação de card.
//
// Ao escolher uma sprint, sugere as datas de início e fim da sprint para o item.
// Valores digitados pelo usuário (`touched`) nunca são substituídos; ao voltar a
// sprint ao estado neutro, apenas sugestões não digitadas são limpas.

export interface SprintDatesSource {
  startDate?: string | null
  endDate?: string | null
}

export interface ItemDates {
  startDate: string
  dueDate: string
}

export function suggestDatesForSprint(
  sprint: SprintDatesSource | undefined,
  current: ItemDates,
  touched: boolean,
): ItemDates {
  if (!sprint) return touched ? current : { startDate: '', dueDate: '' }
  if (touched) return current
  return {
    startDate: sprint.startDate || current.startDate,
    dueDate: sprint.endDate || current.dueDate,
  }
}
