import { Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy, Component, type ReactNode, type ErrorInfo } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './components/Toast'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
  }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-background gap-4 p-8">
          <div className="max-w-2xl w-full bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-6">
            <h2 className="text-red-700 dark:text-red-300 font-bold text-lg mb-2">Erro de renderização</h2>
            <p className="text-red-600 dark:text-red-400 text-sm font-mono bg-red-100 dark:bg-red-900 rounded p-3 break-all">
              {err.message}
            </p>
            {err.stack && (
              <pre className="mt-3 text-xs text-red-500 dark:text-red-500 overflow-auto max-h-48 bg-red-100 dark:bg-red-900 rounded p-3">
                {err.stack}
              </pre>
            )}
            <button
              onClick={() => this.setState({ error: null })}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const LoginPage = lazy(() => import('./pages/LoginPage'))
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'))
const BoardPage = lazy(() => import('./pages/BoardPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const AccountPage = lazy(() => import('./pages/AccountPage'))

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen bg-background"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
      <ErrorBoundary>
      <Suspense fallback={<div className="flex items-center justify-center h-screen bg-background"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
          <Route path="/projects/:projectId/board" element={<ProtectedRoute><BoardPage /></ProtectedRoute>} />
          <Route path="/projects/:projectId/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
      </ToastProvider>
    </AuthProvider>
  )
}
