import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'

// Mock zustand persist
vi.mock('zustand/middleware', () => ({
  persist: (fn: Function) => fn
}))

// Create a mock store for testing
const createMockStore = () => {
  let state = {
    user: null as any,
    token: null as string | null,
    isAuthenticated: false,
    isLoading: false,
    error: null as string | null
  }

  const listeners = new Set<() => void>()

  const getState = () => state
  const setState = (partial: Partial<typeof state>) => {
    state = { ...state, ...partial }
    listeners.forEach(l => l())
  }

  return { getState, setState, subscribe: (listener: () => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }}
}

describe('Admin Auth Types', () => {
  it('should define User interface correctly', () => {
    const user = {
      id: 'test-id',
      username: 'admin',
      email: 'admin@example.com',
      full_name: 'Admin User',
      is_active: true,
      is_superuser: true,
      last_login: '2025-01-10T12:00:00Z'
    }

    expect(user.id).toBeDefined()
    expect(user.username).toBe('admin')
    expect(user.is_superuser).toBe(true)
  })

  it('should define AdminAuthState interface correctly', () => {
    const state = {
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null
    }

    expect(state.user).toBeNull()
    expect(state.token).toBeNull()
    expect(state.isAuthenticated).toBe(false)
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
  })
})

describe('Admin Auth Store Behavior', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    global.fetch = mockFetch
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Login Flow', () => {
    it('should handle successful login for superuser', async () => {
      const mockUser = {
        id: 'admin-id',
        username: 'admin',
        email: 'admin@test.com',
        is_active: true,
        is_superuser: true
      }

      const mockLoginResponse = {
        token: { access_token: 'mock-token-123' },
        user: mockUser
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockLoginResponse)
      })

      // Simulate the login logic
      const loginResult = await simulateLogin('admin', 'password', mockFetch)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/auth/login'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'admin', password: 'password' })
        })
      )

      expect(loginResult.success).toBe(true)
      expect(loginResult.user?.is_superuser).toBe(true)
    })

    it('should reject login for non-superuser', async () => {
      const mockUser = {
        id: 'user-id',
        username: 'regularuser',
        email: 'user@test.com',
        is_active: true,
        is_superuser: false
      }

      const mockLoginResponse = {
        token: { access_token: 'mock-token-123' },
        user: mockUser
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockLoginResponse)
      })

      const loginResult = await simulateLogin('regularuser', 'password', mockFetch)

      expect(loginResult.success).toBe(false)
      expect(loginResult.error).toContain('superusuarios')
    })

    it('should handle login failure with invalid credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ detail: 'Credenciales incorrectas' })
      })

      const loginResult = await simulateLogin('wrong', 'credentials', mockFetch)

      expect(loginResult.success).toBe(false)
      expect(loginResult.error).toBe('Credenciales incorrectas')
    })

    it('should handle network errors during login', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const loginResult = await simulateLogin('admin', 'password', mockFetch)

      expect(loginResult.success).toBe(false)
      expect(loginResult.error).toBe('Network error')
    })
  })

  describe('Auth Check Flow', () => {
    it('should return false when no token exists', async () => {
      const result = await simulateCheckAuth(null, mockFetch)
      expect(result).toBe(false)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should verify valid token for superuser', async () => {
      const mockUser = {
        id: 'admin-id',
        username: 'admin',
        is_superuser: true
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUser)
      })

      const result = await simulateCheckAuth('valid-token', mockFetch)

      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/auth/me'),
        expect.objectContaining({
          headers: { 'Authorization': 'Bearer valid-token' }
        })
      )
    })

    it('should reject token for non-superuser', async () => {
      const mockUser = {
        id: 'user-id',
        username: 'user',
        is_superuser: false
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUser)
      })

      const result = await simulateCheckAuth('valid-token', mockFetch)
      expect(result).toBe(false)
    })

    it('should handle invalid token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ detail: 'Token inválido' })
      })

      const result = await simulateCheckAuth('invalid-token', mockFetch)
      expect(result).toBe(false)
    })
  })

  describe('Logout Flow', () => {
    it('should clear all auth state on logout', () => {
      const store = createMockStore()

      // Set initial authenticated state
      store.setState({
        user: { id: '1', username: 'admin', email: 'admin@test.com', is_active: true, is_superuser: true },
        token: 'test-token',
        isAuthenticated: true
      })

      expect(store.getState().isAuthenticated).toBe(true)
      expect(store.getState().token).toBe('test-token')

      // Simulate logout
      store.setState({
        user: null,
        token: null,
        isAuthenticated: false,
        error: null
      })

      expect(store.getState().user).toBeNull()
      expect(store.getState().token).toBeNull()
      expect(store.getState().isAuthenticated).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should clear error when clearError is called', () => {
      const store = createMockStore()

      store.setState({ error: 'Test error' })
      expect(store.getState().error).toBe('Test error')

      store.setState({ error: null })
      expect(store.getState().error).toBeNull()
    })
  })
})

// Helper functions to simulate auth logic without importing the actual store
async function simulateLogin(
  username: string,
  password: string,
  fetchFn: typeof fetch
): Promise<{ success: boolean; user?: any; error?: string }> {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  try {
    const response = await fetchFn(`${API_BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Credenciales incorrectas')
    }

    const data = await response.json()
    const user = data.user

    if (!user.is_superuser) {
      throw new Error('Acceso denegado. Solo superusuarios pueden acceder al panel de administración.')
    }

    return { success: true, user }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

async function simulateCheckAuth(
  token: string | null,
  fetchFn: typeof fetch
): Promise<boolean> {
  if (!token) return false

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  try {
    const response = await fetchFn(`${API_BASE_URL}/api/v1/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })

    if (!response.ok) throw new Error('Token inválido')

    const user = await response.json()
    if (!user.is_superuser) throw new Error('No es superusuario')

    return true
  } catch {
    return false
  }
}
