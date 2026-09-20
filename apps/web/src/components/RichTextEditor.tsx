import { Component, Suspense, lazy, type ComponentProps, type ErrorInfo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

// Tiptap é pesado (~338 KB no build baseline) e só é necessário quando um
// formulário abre o editor de texto rico. O carregamento sob demanda mantém o
// Tiptap fora do bundle inicial e do chunk do board.
const RichTextEditorImpl = lazy(() => import('./RichTextEditorImpl').then(module => ({ default: module.RichTextEditorImpl })))

type Props = ComponentProps<typeof RichTextEditorImpl>

class EditorLoadBoundary extends Component<{ children: ReactNode; message: string; retryLabel: string }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Falha ao carregar o editor de texto rico', error, info.componentStack)
  }

  private handleRetry = () => this.setState({ failed: false })

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="flex h-28 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 text-center text-sm text-muted-foreground" role="alert">
        <span>{this.props.message}</span>
        <button type="button" className="font-semibold text-primary underline" onClick={this.handleRetry}>{this.props.retryLabel}</button>
      </div>
    )
  }
}

function EditorSkeleton({ label }: { label: string }) {
  return <div className="h-28 animate-pulse rounded-lg bg-muted" role="status" aria-busy="true" aria-label={label} />
}

export function RichTextEditor(props: Props) {
  const { t } = useTranslation()
  const loadingLabel = t('richText.loading')
  return (
    <EditorLoadBoundary message={t('richText.loadError')} retryLabel={t('richText.retry')}>
      <Suspense fallback={<EditorSkeleton label={loadingLabel} />}>
        <RichTextEditorImpl {...props} />
      </Suspense>
    </EditorLoadBoundary>
  )
}
