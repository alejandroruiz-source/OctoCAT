import { createContext, useEffect, useState, type ReactNode } from 'react'
import { UserManager, type User } from 'oidc-client-ts'
import { setAuthToken, setTestAuth } from '../api/client'

export interface SessionUser {
  userId: string
  role: 'BUYER' | 'APPROVER' | 'SUPPLIER'
  displayName: string
  email: string
}

export interface AuthContextValue {
  user: SessionUser | null
  isLoading: boolean
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

const AUTH_DISABLED = import.meta.env.VITE_AUTH_DISABLED === 'true'
const TEST_USER_ROLE = (import.meta.env.VITE_TEST_USER_ROLE ?? 'BUYER') as SessionUser['role']
const TEST_USER_ID = import.meta.env.VITE_TEST_USER_ID ?? 'test-buyer-001'

let userManager: UserManager | null = null

function getUserManager(): UserManager {
  if (!userManager) {
    userManager = new UserManager({
      authority: import.meta.env.VITE_OIDC_AUTHORITY,
      client_id: import.meta.env.VITE_OIDC_CLIENT_ID,
      redirect_uri: `${window.location.origin}/auth/callback`,
      post_logout_redirect_uri: window.location.origin,
      scope: 'openid profile email',
    })
  }
  return userManager
}

function oidcUserToSession(user: User): SessionUser {
  const profile = user.profile as Record<string, unknown>
  return {
    userId: user.profile.sub,
    role: (profile['role'] as SessionUser['role']) ?? 'BUYER',
    displayName: (user.profile.name ?? user.profile.preferred_username ?? user.profile.sub) as string,
    email: (user.profile.email ?? '') as string,
  }
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [isLoading, setIsLoading] = useState(!AUTH_DISABLED)

  useEffect(() => {
    if (AUTH_DISABLED) {
      const testUser: SessionUser = {
        userId: TEST_USER_ID,
        role: TEST_USER_ROLE,
        displayName: `Test ${TEST_USER_ROLE}`,
        email: `test@octocat.local`,
      }
      setUser(testUser)
      setTestAuth(TEST_USER_ID, TEST_USER_ROLE)
      return
    }

    const mgr = getUserManager()

    mgr.getUser().then((oidcUser) => {
      if (oidcUser && !oidcUser.expired) {
        const session = oidcUserToSession(oidcUser)
        setUser(session)
        setAuthToken(oidcUser.access_token)
      } else {
        mgr.signinRedirect().catch(console.error)
      }
      setIsLoading(false)
    }).catch(() => {
      mgr.signinRedirect().catch(console.error)
      setIsLoading(false)
    })

    const handleUserLoaded = (oidcUser: User) => {
      const session = oidcUserToSession(oidcUser)
      setUser(session)
      setAuthToken(oidcUser.access_token)
    }

    mgr.events.addUserLoaded(handleUserLoaded)
    return () => mgr.events.removeUserLoaded(handleUserLoaded)
  }, [])

  async function logout(): Promise<void> {
    if (AUTH_DISABLED) {
      setUser(null)
      return
    }
    const mgr = getUserManager()
    await mgr.signoutRedirect()
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
