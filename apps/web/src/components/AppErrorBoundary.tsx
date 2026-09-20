import { Component, type ErrorInfo, type ReactNode } from 'react'
import i18n from '../i18n'
import { createErrorReference, describeRenderError, reportRenderError, shortErrorReference } from '../lib/renderError'

interface Props {
  children: ReactNode
  // Injetável para testes; em runtime segue o modo do Vite.
  isProduction?: boolean
}

interface State {
  error: Error | null
  reference: string | null
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, reference: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error, reference: createErrorReference() }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportRenderError({ reference: this.state.reference, error, componentStack: info.componentStack ?? null })
  }

  private get isProduction(): boolean {
    return this.props.isProduction ?? import.meta.env.PROD
  }

  private handleRetry = () => {
    this.setState({ error: null, reference: null })
  }

  render() {
    const { error, reference } = this.state
    if (!error) return this.props.children

    const details = describeRenderError(error, this.isProduction)
    const currentReference = reference ?? createErrorReference()

    return (
      <div role="alert" className="flex flex-col items-center justify-center h-screen bg-background gap-4 p-8">
        <div className="max-w-2xl w-full bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-6">
          <h2 className="text-red-700 dark:text-red-300 font-bold text-lg mb-2">{i18n.t('renderError')}</h2>
          <p className="text-red-600 dark:text-red-400 text-sm">{i18n.t('renderErrorGeneric')}</p>
          {details.showDetails && (
            <>
              {details.message && (
                <p className="mt-3 text-red-600 dark:text-red-400 text-sm font-mono bg-red-100 dark:bg-red-900 rounded p-3 break-all">
                  {details.message}
                </p>
              )}
              {details.stack && (
                <pre className="mt-3 text-xs text-red-500 dark:text-red-500 overflow-auto max-h-48 bg-red-100 dark:bg-red-900 rounded p-3">
                  {details.stack}
                </pre>
              )}
            </>
          )}
          <p className="mt-4 text-xs text-red-600 dark:text-red-400">
            {i18n.t('renderErrorReference', { reference: shortErrorReference(currentReference) })}
          </p>
          <button
            onClick={this.handleRetry}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition"
          >
            {i18n.t('renderErrorRetry')}
          </button>
        </div>
      </div>
    )
  }
}
