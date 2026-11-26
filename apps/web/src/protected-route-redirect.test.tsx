import { screen } from './test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import * as bunTest from 'bun:test'

const auth: { user: { id: string } | null; loading: boolean } = { user: null, loading: false }

const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module
mockModule('./contexts/AuthContext', () => ({ useAuth: () => auth }))

const { ProtectedRoute } = await import('./components/ProtectedRoute')

function LoginProbe() {
  const location = useLocation()
  return <output data-testid="login">{new URLSearchParams(location.search).get('redirect') ?? ''}</output>
}

function renderAt(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/login" element={<LoginProbe />} />
        <Route path="/oauth/authorize" element={<ProtectedRoute><p>consentimento</p></ProtectedRoute>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  auth.user = null
  auth.loading = false
})

describe('ProtectedRoute — destino preservado no login', () => {
  test('sem usuário vai para /login com o caminho e a query originais em redirect', () => {
    renderAt('/oauth/authorize?client_id=cli-1&state=xyz&redirect_uri=http%3A%2F%2F127.0.0.1%2Fcb')
    expect(screen.getByTestId('login').textContent).toBe('/oauth/authorize?client_id=cli-1&state=xyz&redirect_uri=http%3A%2F%2F127.0.0.1%2Fcb')
  })

  test('com usuário renderiza a rota protegida', () => {
    auth.user = { id: 'u1' }
    renderAt('/oauth/authorize?client_id=cli-1')
    expect(screen.getByText('consentimento')).toBeInTheDocument()
    expect(screen.queryByTestId('login')).toBeNull()
  })
})
