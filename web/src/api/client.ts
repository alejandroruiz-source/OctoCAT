const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1'
const AUTH_DISABLED = import.meta.env.VITE_AUTH_DISABLED === 'true'

export interface ApiError {
  status: number
  code: string
  message: string
}

let _token: string | null = null
let _testUserId: string | null = null
let _testUserRole: string | null = null

export function setAuthToken(token: string | null): void {
  _token = token
}

export function setTestAuth(userId: string, role: string): void {
  _testUserId = userId
  _testUserRole = role
}

export class ApiRequestError extends Error {
  readonly status: number
  readonly code: string

  constructor(error: ApiError) {
    super(error.message)
    this.name = 'ApiRequestError'
    this.status = error.status
    this.code = error.code
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(init?.body != null ? { 'Content-Type': 'application/json' } : {}),
    ...(init?.headers as Record<string, string>),
  }

  if (AUTH_DISABLED && _testUserId && _testUserRole) {
    headers['x-test-user-id'] = _testUserId
    headers['x-test-user-role'] = _testUserRole
  } else if (_token) {
    headers['Authorization'] = `Bearer ${_token}`
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  })

  if (response.status === 204) {
    return undefined as unknown as T
  }

  const body = await response.json()

  if (!response.ok) {
    throw new ApiRequestError({
      status: response.status,
      code: body.error ?? 'UNKNOWN',
      message: body.message ?? 'An unexpected error occurred',
    })
  }

  return body as T
}
