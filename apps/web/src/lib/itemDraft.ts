// Rascunho local da descrição de itens (Task/Bug/Subtask).
//
// A descrição rica pode ter textos longos que só são persistidos no servidor
// quando o usuário clica em "Salvar alterações". Este utilitário grava o texto
// em `localStorage` enquanto o usuário digita, para sobreviver a refresh, queda
// de conexão, expiração de sessão ou fechamento acidental da modal.
//
// O rascunho é 100% client-side: nunca vai ao servidor e é removido após o
// salvamento ser confirmado. Todas as operações são best-effort e defensivas,
// porque `localStorage` pode estar indisponível (modo privado) ou cheio.

const ITEM_DRAFT_PREFIX = 'item-draft:'
const ITEM_DRAFT_FIELD = 'description'

export interface ItemDraft {
  /** Markdown do rascunho editado pelo usuário. */
  value: string
  /** Descrição do servidor no momento em que o rascunho foi gravado. */
  base: string
  /** Timestamp ISO da última gravação. */
  updatedAt: string
}

export function itemDraftKey(projectId: string, itemId: string): string {
  return `${ITEM_DRAFT_PREFIX}${projectId}:${itemId}:${ITEM_DRAFT_FIELD}`
}

export function readItemDraft(projectId: string, itemId: string): ItemDraft | null {
  const key = itemDraftKey(projectId, itemId)
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    let parsed: Partial<ItemDraft> | null
    try {
      parsed = JSON.parse(raw) as Partial<ItemDraft> | null
    } catch {
      localStorage.removeItem(key)
      return null
    }
    if (!parsed || typeof parsed.value !== 'string') {
      localStorage.removeItem(key)
      return null
    }
    return {
      value: parsed.value,
      base: typeof parsed.base === 'string' ? parsed.base : '',
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
    }
  } catch {
    return null
  }
}

export function writeItemDraft(projectId: string, itemId: string, value: string, base: string): void {
  try {
    const draft: ItemDraft = { value, base, updatedAt: new Date().toISOString() }
    localStorage.setItem(itemDraftKey(projectId, itemId), JSON.stringify(draft))
  } catch {
    // SecurityError/QuotaExceededError: rascunho é best-effort e nunca bloqueia a edição.
  }
}

export function clearItemDraft(projectId: string, itemId: string): void {
  try {
    localStorage.removeItem(itemDraftKey(projectId, itemId))
  } catch {
    // localStorage indisponível: nada a limpar.
  }
}

export function clearAllItemDrafts(): void {
  try {
    const keys: string[] = []
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key && key.startsWith(ITEM_DRAFT_PREFIX)) keys.push(key)
    }
    for (const key of keys) localStorage.removeItem(key)
  } catch {
    // localStorage indisponível: nada a limpar.
  }
}
