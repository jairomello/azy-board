export type AssistantMutation = { toolName: string; result?: unknown }

const ASSISTANT_MUTATION_EVENT = 'azyboard:assistant-mutation'

export function notifyAssistantMutation(detail: AssistantMutation): void {
  window.dispatchEvent(new CustomEvent<AssistantMutation>(ASSISTANT_MUTATION_EVENT, { detail }))
}

export function onAssistantMutation(handler: (detail: AssistantMutation) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<AssistantMutation>).detail)
  window.addEventListener(ASSISTANT_MUTATION_EVENT, listener)
  return () => window.removeEventListener(ASSISTANT_MUTATION_EVENT, listener)
}
