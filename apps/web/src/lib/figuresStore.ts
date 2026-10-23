// Card T87 — lista de anexos do card observável pelas node views da figura.
//
// As node views do Tiptap são renderizadas em uma raiz React própria, então o
// contexto do React não atravessa até elas. Este store mínimo é passado por
// closure na criação da extensão e avisa as views quando a lista de anexos do
// card chega — é o que permite decidir entre exibir a imagem, um cartão de
// arquivo (formato sem exibição inline aprovada) ou o estado de indisponível.
export interface FigureAttachment {
  id: string
  mimeType: string
  name: string
  url: string
}

export interface FiguresStore {
  /** `null` enquanto a lista do card ainda não foi carregada. */
  getSnapshot: () => FigureAttachment[] | null
  subscribe: (listener: () => void) => () => void
  set: (list: FigureAttachment[]) => void
  read: (attachmentId: string) => FigureAttachment | null
  ready: () => boolean
}

export function createFiguresStore(): FiguresStore {
  let snapshot: FigureAttachment[] | null = null
  const listeners = new Set<() => void>()

  const read = (attachmentId: string): FigureAttachment | null =>
    snapshot?.find(attachment => attachment.id === attachmentId) ?? null

  return {
    getSnapshot: () => snapshot,
    subscribe: listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    set: list => {
      snapshot = list
      for (const listener of listeners) listener()
    },
    read,
    ready: () => snapshot !== null,
  }
}
