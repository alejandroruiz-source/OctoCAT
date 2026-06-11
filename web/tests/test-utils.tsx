import { type ReactNode } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthContext, type AuthContextValue } from '../src/auth/AuthProvider'

const DEFAULT_USER: AuthContextValue = {
  user: { userId: 'test-buyer-001', role: 'BUYER', displayName: 'Test Buyer', email: 'buyer@test.local' },
  isLoading: false,
  logout: async () => {},
}

function makeWrapper(
  user: AuthContextValue = DEFAULT_USER,
  path = '/',
  routePattern = '*',
) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <AuthContext.Provider value={user}>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path={routePattern} element={<>{children}</>} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    )
  }
}

export function renderWithProviders(
  ui: ReactNode,
  options?: RenderOptions & { user?: AuthContextValue; path?: string; routePattern?: string },
) {
  const { user, path, routePattern, ...rest } = options ?? {}
  return render(ui, { wrapper: makeWrapper(user, path, routePattern), ...rest })
}

export { DEFAULT_USER }
export * from '@testing-library/react'
