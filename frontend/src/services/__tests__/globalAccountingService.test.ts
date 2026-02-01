import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import apiClient from '../../utils/api-client'
import {
  getGlobalCashBalances,
  initializeGlobalAccounts,
  setGlobalAccountBalance,
  getGlobalBalanceAccounts,
  createGlobalBalanceAccount,
  getGlobalExpenses,
  createGlobalExpense,
  payGlobalExpense,
  getGlobalPayables,
  createGlobalPayable,
  payGlobalPayable,
  getGlobalBalanceGeneralSummary,
  getGlobalPatrimonySummary
} from '../globalAccountingService'

// Mock the API client
vi.mock('../../utils/api-client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn()
  }
}))

describe('Global Accounting Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================
  // Cash Balances Tests
  // ============================================

  describe('getGlobalCashBalances', () => {
    it('should fetch cash balances successfully', async () => {
      const mockResponse = {
        data: {
          caja_menor: { id: '1', name: 'Caja Menor', balance: 500000 },
          caja_mayor: { id: '2', name: 'Caja Mayor', balance: 2000000 },
          banco: { id: '3', name: 'Banco', balance: 5000000 },
          total_liquid: 7500000
        }
      }

      ;(apiClient.get as Mock).mockResolvedValueOnce(mockResponse)

      const result = await getGlobalCashBalances()

      expect(apiClient.get).toHaveBeenCalledWith('/global/accounting/cash-balances')
      expect(result.total_liquid).toBe(7500000)
    })

    it('should handle API errors', async () => {
      ;(apiClient.get as Mock).mockRejectedValueOnce(new Error('Network error'))

      await expect(getGlobalCashBalances()).rejects.toThrow('Network error')
    })
  })

  describe('initializeGlobalAccounts', () => {
    it('should initialize accounts with balances', async () => {
      const mockResponse = {
        data: {
          message: 'Accounts initialized',
          accounts: { caja: 'uuid-1', banco: 'uuid-2' }
        }
      }

      ;(apiClient.post as Mock).mockResolvedValueOnce(mockResponse)

      const result = await initializeGlobalAccounts(100000, 500000)

      expect(apiClient.post).toHaveBeenCalledWith(
        '/global/accounting/initialize-accounts',
        null,
        { params: { caja_initial_balance: 100000, banco_initial_balance: 500000 } }
      )
      expect(result.message).toBe('Accounts initialized')
    })
  })

  describe('setGlobalAccountBalance', () => {
    it('should set account balance', async () => {
      const mockResponse = {
        data: {
          account_id: 'uuid-1',
          old_balance: 100000,
          new_balance: 200000,
          adjustment: 100000
        }
      }

      ;(apiClient.post as Mock).mockResolvedValueOnce(mockResponse)

      const result = await setGlobalAccountBalance('1101', 200000, 'Ajuste inicial')

      expect(apiClient.post).toHaveBeenCalled()
      expect(result.new_balance).toBe(200000)
    })
  })

  // ============================================
  // Balance Accounts Tests
  // ============================================

  describe('getGlobalBalanceAccounts', () => {
    it('should fetch balance accounts', async () => {
      const mockResponse = {
        data: [
          { id: '1', name: 'Caja', code: '1101', balance: 500000 },
          { id: '2', name: 'Banco', code: '1102', balance: 2000000 }
        ]
      }

      ;(apiClient.get as Mock).mockResolvedValueOnce(mockResponse)

      const result = await getGlobalBalanceAccounts()

      expect(apiClient.get).toHaveBeenCalledWith('/global/accounting/balance-accounts', { params: { account_type: undefined, is_active: undefined } })
      expect(result).toHaveLength(2)
    })

    it('should filter by account type', async () => {
      const mockResponse = { data: [] }

      ;(apiClient.get as Mock).mockResolvedValueOnce(mockResponse)

      await getGlobalBalanceAccounts('asset_fixed')

      expect(apiClient.get).toHaveBeenCalledWith(
        '/global/accounting/balance-accounts',
        { params: { account_type: 'asset_fixed', is_active: undefined } }
      )
    })
  })

  describe('createGlobalBalanceAccount', () => {
    it('should create a new balance account', async () => {
      const newAccount = {
        account_type: 'asset_fixed' as const,
        name: 'Maquina de Coser',
        description: 'Maquina industrial',
        balance: 3500000
      }

      const mockResponse = {
        data: { id: 'new-id', ...newAccount }
      }

      ;(apiClient.post as Mock).mockResolvedValueOnce(mockResponse)

      const result = await createGlobalBalanceAccount(newAccount)

      expect(apiClient.post).toHaveBeenCalledWith(
        '/global/accounting/balance-accounts',
        newAccount
      )
      expect(result.name).toBe('Maquina de Coser')
    })
  })

  // ============================================
  // Expenses Tests
  // ============================================

  describe('getGlobalExpenses', () => {
    it('should fetch expenses', async () => {
      const mockResponse = {
        data: [
          { id: '1', category: 'utilities', description: 'Luz', amount: 150000 },
          { id: '2', category: 'rent', description: 'Arriendo', amount: 2500000 }
        ]
      }

      ;(apiClient.get as Mock).mockResolvedValueOnce(mockResponse)

      const result = await getGlobalExpenses()

      expect(apiClient.get).toHaveBeenCalled()
      expect(result).toHaveLength(2)
    })

    it('should filter by category', async () => {
      const mockResponse = { data: [] }

      ;(apiClient.get as Mock).mockResolvedValueOnce(mockResponse)

      await getGlobalExpenses({ category: 'utilities' })

      expect(apiClient.get).toHaveBeenCalledWith(
        '/global/accounting/expenses',
        expect.objectContaining({
          params: expect.objectContaining({ category: 'utilities' })
        })
      )
    })
  })

  describe('createGlobalExpense', () => {
    it('should create a new expense', async () => {
      const newExpense = {
        category: 'rent' as const,
        description: 'Arriendo mensual',
        amount: 2500000,
        expense_date: '2025-01-10',
        vendor: 'Inmobiliaria'
      }

      const mockResponse = {
        data: { id: 'new-id', ...newExpense, is_paid: false }
      }

      ;(apiClient.post as Mock).mockResolvedValueOnce(mockResponse)

      const result = await createGlobalExpense(newExpense)

      expect(apiClient.post).toHaveBeenCalledWith(
        '/global/accounting/expenses',
        newExpense
      )
      expect(result.is_paid).toBe(false)
    })
  })

  describe('payGlobalExpense', () => {
    it('should record expense payment', async () => {
      const payment = {
        amount: 150000,
        payment_method: 'cash' as const
      }

      const mockResponse = {
        data: {
          id: 'expense-id',
          amount: 150000,
          amount_paid: 150000,
          is_paid: true
        }
      }

      ;(apiClient.post as Mock).mockResolvedValueOnce(mockResponse)

      const result = await payGlobalExpense('expense-id', payment)

      expect(apiClient.post).toHaveBeenCalledWith(
        '/global/accounting/expenses/expense-id/pay',
        payment
      )
      expect(result.is_paid).toBe(true)
    })
  })

  // ============================================
  // Accounts Payable Tests
  // ============================================

  describe('getGlobalPayables', () => {
    it('should fetch payables', async () => {
      const mockResponse = {
        data: [
          { id: '1', vendor: 'Proveedor A', amount: 500000 }
        ]
      }

      ;(apiClient.get as Mock).mockResolvedValueOnce(mockResponse)

      const result = await getGlobalPayables()

      expect(apiClient.get).toHaveBeenCalled()
      expect(result).toHaveLength(1)
    })
  })

  describe('createGlobalPayable', () => {
    it('should create a new payable', async () => {
      const newPayable = {
        vendor: 'Proveedor Nuevo',
        amount: 300000,
        description: 'Compra de telas',
        invoice_date: '2026-01-23'
      }

      const mockResponse = {
        data: { id: 'new-id', ...newPayable, is_paid: false }
      }

      ;(apiClient.post as Mock).mockResolvedValueOnce(mockResponse)

      const result = await createGlobalPayable(newPayable)

      expect(apiClient.post).toHaveBeenCalledWith(
        '/global/accounting/payables',
        newPayable
      )
      expect(result.vendor).toBe('Proveedor Nuevo')
    })
  })

  describe('payGlobalPayable', () => {
    it('should record payable payment', async () => {
      const payment = {
        amount: 300000,
        payment_method: 'transfer' as const
      }

      const mockResponse = {
        data: {
          id: 'payable-id',
          is_paid: true
        }
      }

      ;(apiClient.post as Mock).mockResolvedValueOnce(mockResponse)

      const result = await payGlobalPayable('payable-id', payment)

      expect(result.is_paid).toBe(true)
    })
  })

  // ============================================
  // Balance General Tests
  // ============================================

  describe('getGlobalBalanceGeneralSummary', () => {
    it('should fetch balance general summary', async () => {
      const mockResponse = {
        data: {
          assets: { total: 10000000 },
          liabilities: { total: 3000000 },
          equity: { total: 7000000 },
          net_worth: 7000000
        }
      }

      ;(apiClient.get as Mock).mockResolvedValueOnce(mockResponse)

      const result = await getGlobalBalanceGeneralSummary()

      expect(apiClient.get).toHaveBeenCalledWith('/global/accounting/balance-general/summary')
      expect(result.net_worth).toBe(7000000)
    })
  })

  describe('getGlobalPatrimonySummary', () => {
    it('should fetch patrimony summary', async () => {
      const mockResponse = {
        data: {
          assets: {
            cash_and_bank: { caja: 500000, banco: 2000000 },
            total: 2500000
          },
          liabilities: {
            total: 500000
          },
          summary: {
            total_assets: 2500000,
            total_liabilities: 500000,
            net_patrimony: 2000000,
            is_positive: true
          },
          generated_at: '2026-01-23T00:00:00Z'
        }
      }

      ;(apiClient.get as Mock).mockResolvedValueOnce(mockResponse)

      const result = await getGlobalPatrimonySummary()

      expect(apiClient.get).toHaveBeenCalledWith('/global/accounting/patrimony-summary')
      expect(result.summary.net_patrimony).toBe(2000000)
    })
  })
})
