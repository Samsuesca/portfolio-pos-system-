import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { vi } from 'vitest'

// Custom wrapper with all providers
interface AllProvidersProps {
  children: React.ReactNode
}

const AllProviders = ({ children }: AllProvidersProps) => {
  return (
    <>
      {children}
    </>
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

// Helper to create mock admin user state
export const createMockAdminUser = (overrides = {}) => ({
  id: 'test-admin-id',
  username: 'admin',
  email: 'admin@example.com',
  full_name: 'Admin User',
  is_active: true,
  is_superuser: true,
  ...overrides
})

// Helper to create mock school
export const createMockSchool = (overrides = {}) => ({
  id: 'test-school-id',
  code: 'TST-001',
  name: 'Test School',
  slug: 'test-school',
  is_active: true,
  address: '123 Test Street',
  phone: '123-456-7890',
  ...overrides
})

// Helper to create mock user
export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  username: 'testuser',
  email: 'test@example.com',
  full_name: 'Test User',
  is_active: true,
  is_superuser: false,
  school_roles: [],
  ...overrides
})

// Helper to create mock payment account
export const createMockPaymentAccount = (overrides = {}) => ({
  id: 'test-account-id',
  name: 'Test Account',
  account_type: 'bank',
  account_number: '1234567890',
  is_active: true,
  ...overrides
})

// Helper to create mock delivery zone
export const createMockDeliveryZone = (overrides = {}) => ({
  id: 'test-zone-id',
  name: 'Test Zone',
  description: 'Test delivery zone',
  delivery_fee: 5000,
  is_active: true,
  ...overrides
})

// Helper to create mock global product
export const createMockGlobalProduct = (overrides = {}) => ({
  id: 'test-product-id',
  code: 'GP-001',
  name: 'Test Global Product',
  category: 'camisa',
  base_price: 50000,
  is_active: true,
  ...overrides
})

// Mock API response helper
export const createMockApiResponse = <T,>(data: T, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
  text: () => Promise.resolve(JSON.stringify(data))
})

// Mock fetch with response
export const mockFetch = (response: unknown, status = 200) => {
  return vi.fn().mockResolvedValue(createMockApiResponse(response, status))
}

// Wait for async operations
export const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0))
