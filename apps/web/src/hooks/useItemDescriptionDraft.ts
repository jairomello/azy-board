import { useCallback, useEffect, useRef, useState } from 'react'
import { clearItemDraft, readItemDraft, writeItemDraft } from '../lib/itemDraft'

// Debounce trailing da gravação do rascunho. Mesmo valor usado no salvamento
// debounced de `GeneralSettingsSections.tsx`.
export const ITEM_DRAFT_DEBOUNCE_MS = 800

interface UseItemDescriptionDraftResult {
  description: string
  setDescription: (value: string) => void
  draftRecovered: boolean
  discardDraft: () => void
  commitDraft: () => void
}

// Coordena o rascunho local da descrição de um item: hidratação ao trocar de
// item, gravação com debounce, descarte manual e limpeza após salvar.
export function useItemDescriptionDraft(
  projectId: string,
  itemId: string,
  serverDescription: string | null,
): UseItemDescriptionDraftResult {
  const serverValue = serverDescription ?? ''
  const [description, setDescription] = useState(serverValue)
  const [draftRecovered, setDraftRecovered] = useState(false)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef(false)
  const hydratingRef = useRef(true)
  const valueRef = useRef(description)
  const hydratedValueRef = useRef(serverValue)
  const metaRef = useRef({ itemId, base: serverValue })

  useEffect(() => {
    valueRef.current = description
  }, [description])

  // Hidrata ao montar e sempre que o item muda. O valor `serverValue` NÃO entra
  // nas dependências de propósito: uma atualização do servidor no mesmo item não
  // deve descartar nem sobrescrever o rascunho em edição.
  useEffect(() => {
    const draft = itemId !== '__new__' ? readItemDraft(projectId, itemId) : null
    const initial = draft && draft.value !== serverValue ? draft.value : serverValue
    if (draft && draft.value === serverValue) clearItemDraft(projectId, itemId)

    hydratingRef.current = true
    hydratedValueRef.current = initial
    valueRef.current = initial
    metaRef.current = { itemId, base: serverValue }
    pendingRef.current = false
    setDraftRecovered(Boolean(draft && draft.value !== serverValue))
    setDescription(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, itemId])

  // Grava o rascunho com debounce a cada edição; ignora a hidratação e itens novos.
  useEffect(() => {
    if (itemId === '__new__') return
    if (hydratingRef.current) {
      hydratingRef.current = false
      return
    }
    if (description === hydratedValueRef.current) return

    pendingRef.current = true
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      writeItemDraft(projectId, itemId, description, metaRef.current.base)
      pendingRef.current = false
      timerRef.current = null
    }, ITEM_DRAFT_DEBOUNCE_MS)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [description, itemId, projectId])

  // Fecha a modal logo após digitar não pode perder o texto: grava o pendente no unmount.
  useEffect(() => {
    return () => {
      const meta = metaRef.current
      if (pendingRef.current && meta.itemId !== '__new__') {
        writeItemDraft(projectId, meta.itemId, valueRef.current, meta.base)
      }
    }
  }, [projectId])

  const discardDraft = useCallback(() => {
    if (itemId !== '__new__') clearItemDraft(projectId, itemId)
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    pendingRef.current = false
    hydratedValueRef.current = serverValue
    valueRef.current = serverValue
    setDescription(serverValue)
    setDraftRecovered(false)
  }, [projectId, itemId, serverValue])

  const commitDraft = useCallback(() => {
    if (itemId !== '__new__') clearItemDraft(projectId, itemId)
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    pendingRef.current = false
  }, [projectId, itemId])

  return { description, setDescription, draftRecovered, discardDraft, commitDraft }
}
