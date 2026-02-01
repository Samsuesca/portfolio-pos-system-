import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from 'react-query'

// Create a test query client
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      cacheTime: 0,
      staleTime: 0
    }
  }
})

// Custom wrapper with all providers
interface AllProvidersProps {
  children: React.ReactNode
}

const AllProviders = ({ children }: AllProvidersProps) => {
  const queryClient = createTestQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  )
}

// Custom render function with providers
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllProviders, ...options })

// Re-export everything from testing-library
export * from '@testing-library/react'

// Override render with our custom version
export { customRender as render }

// Helper to create mock auth state
export const createMockAuthState = (overrides = {}) => ({
  user: {
    id: 'test-user-id',
    username: 'testuser',
    email: 'test@example.com',
    full_name: 'Test User',
    is_active: true,
    is_superuser: false
  },
  token: 'mock-jwt-token',
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  ...overrides
})

// Helper to create mock school
export const createMockSchool = (overrides = {}) => ({
  id: 'test-school-id',
  code: 'TST-001',
  name: 'Test School',
  slug: 'test-school',
  is_active: true,
  ...overrides
})

// Helper to create mock product
export const createMockProduct = (overrides = {}) => ({
  id: 'test-product-id',
  code: 'PRD-001',
  name: 'Test Product',
  size: 'M',
  color: 'Blanco',
  price: 50000,
  is_active: true,
  ...overrides
})

// Helper to create mock sale
export const createMockSale = (overrides = {}) => ({
  id: 'test-sale-id',
  code: 'VNT-2025-001',
  total: 100000,
  paid_amount: 100000,
  payment_method: 'cash',
  status: 'completed',
  items: [],
  ...overrides
})

// Wait for async operations
export const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0))

// Import vi from vitest for use in test helpers
import { vi } from 'vitest'
