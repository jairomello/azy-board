import { Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './components/Toast'
import { AssistantProvider } from './contexts/AssistantContext'
import { AzyAgentDrawer } from './components/AzyAgentDrawer'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import RootAssistantSettings from './components/RootAssistantSettings'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'))
const BoardPage = lazy(() => import('./pages/BoardPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const AccountPage = lazy(() => import('./pages/AccountPage'))
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'))
const ProjectDashboardPage = lazy(() => import('./pages/ProjectDashboardPage'))

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
      <AssistantProvider>
      <AppErrorBoundary>
      <Suspense fallback={<div className="flex items-center justify-center h-screen bg-background"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
          <Route path="/projects/:projectId/board" element={<ProtectedRoute><BoardPage /></ProtectedRoute>} />
          <Route path="/projects/:projectId/dashboard" element={<ProtectedRoute><ProjectDashboardPage /></ProtectedRoute>} />
          <Route path="/projects/:projectId/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute><AdminUsersPage /></ProtectedRoute>} />
          <Route path="/admin/assistant" element={<ProtectedRoute><RootAssistantSettings /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
      </Suspense>
      </AppErrorBoundary>
      <AzyAgentDrawer />
      </AssistantProvider>
      </ToastProvider>
    </AuthProvider>
  )
}
