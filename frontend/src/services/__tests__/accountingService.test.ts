import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import apiClient from '../../utils/api-client';
import {
  getAccountingDashboard,
  getCashFlowSummary,
  getTransactions,
  getTransaction,
  createTransaction,
  getExpenses,
  getPendingExpenses,
  getExpensesByCategory,
  createExpense,
  updateExpense,
  payExpense,
  deleteExpense,
  getTodayRegister,
  openCashRegister,
  closeCashRegister,
  getBalanceAccounts,
  createBalanceAccount,
  updateBalanceAccount,
  deleteBalanceAccount,
  getBalanceEntries,
  getAccountsReceivable,
  createAccountReceivable,
  payAccountReceivable,
  deleteAccountReceivable,
  getAccountsPayable,
  createAccountPayable,
  payAccountPayable,
  deleteAccountPayable,
  getCashBalances,
  liquidateCajaMenor,
  getPatrimonySummary,
  getInventoryValuation,
  createDebt,
  createFixedAsset,
  getExpenseCategoryLabel,
  getExpenseCategoryColor,
  getPaymentMethodLabel,
  getAccountTypeLabel,
  getAccountTypeColor,
  getAccountTypeCategory,
} from '../accountingService';

vi.mock('../../utils/api-client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

function paginatedOf<T>(items: T[]) {
  return { items, total: items.length, skip: 0, limit: 100, page: 1, total_pages: 1, has_more: false };
}

const SID = 'school-1';
const BASE = '/schools';

describe('accountingService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  // --- Dashboard & Cash Flow ---
  it('getAccountingDashboard calls correct URL', async () => {
    (apiClient.get as Mock).mockResolvedValue({ data: { today_income: 100 } });
    const result = await getAccountingDashboard(SID);
    expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/${SID}/accounting/dashboard`);
    expect(result.today_income).toBe(100);
  });

  it('getCashFlowSummary passes date params', async () => {
    (apiClient.get as Mock).mockResolvedValue({ data: { net_flow: 5000 } });
    await getCashFlowSummary(SID, '2026-04-01', '2026-04-30');
    expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/${SID}/accounting/cash-flow`, {
      params: { start_date: '2026-04-01', end_date: '2026-04-30' },
    });
  });

  // --- Transactions ---
  it('getTransactions returns paginated data', async () => {
    (apiClient.get as Mock).mockResolvedValue({ data: paginatedOf([{ id: 't-1' }]) });
    const result = await getTransactions(SID, { startDate: '2026-04-01', type: 'income' as any });
    expect(result.items).toHaveLength(1);
  });

  it('getTransaction returns single transaction', async () => {
    (apiClient.get as Mock).mockResolvedValue({ data: { id: 't-1', amount: 50000 } });
    const result = await getTransaction(SID, 't-1');
    expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/${SID}/accounting/transactions/t-1`);
    expect(result.amount).toBe(50000);
  });

  it('createTransaction includes school_id in body', async () => {
    (apiClient.post as Mock).mockResolvedValue({ data: { id: 't-2' } });
    await createTransaction(SID, { amount: 10000, description: 'Venta' } as any);
    expect(apiClient.post).toHaveBeenCalledWith(
      `${BASE}/${SID}/accounting/transactions`,
      expect.objectContaining({ school_id: SID, amount: 10000 }),
    );
  });

  // --- Expenses ---
  it('getExpenses returns paginated data', async () => {
    (apiClient.get as Mock).mockResolvedValue({ data: paginatedOf([{ id: 'e-1' }]) });
    const result = await getExpenses(SID, { category: 'rent' as any });
    expect(result.items).toHaveLength(1);
  });

  it('getPendingExpenses calls pending endpoint', async () => {
    (apiClient.get as Mock).mockResolvedValue({ data: paginatedOf([]) });
    const result = await getPendingExpenses(SID);
    expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/${SID}/accounting/expenses/pending`);
    expect(result.items).toHaveLength(0);
  });

  it('getExpensesByCategory returns array', async () => {
    (apiClient.get as Mock).mockResolvedValue({ data: [{ category: 'rent', total: 2000000 }] });
    const result = await getExpensesByCategory(SID, '2026-04-01', '2026-04-30');
    expect(result).toHaveLength(1);
  });

  it('createExpense includes school_id in body', async () => {
    (apiClient.post as Mock).mockResolvedValue({ data: { id: 'e-2' } });
    await createExpense(SID, { amount: 500000, category: 'rent' } as any);
    expect(apiClient.post).toHaveBeenCalledWith(
      `${BASE}/${SID}/accounting/expenses`,
      expect.objectContaining({ school_id: SID }),
    );
  });

  it('updateExpense patches data', async () => {
    (apiClient.patch as Mock).mockResolvedValue({ data: { id: 'e-1', amount: 600000 } });
    const result = await updateExpense(SID, 'e-1', { amount: 600000 } as any);
    expect(apiClient.patch).toHaveBeenCalledWith(`${BASE}/${SID}/accounting/expenses/e-1`, { amount: 600000 });
    expect(result.amount).toBe(600000);
  });

  it('payExpense posts payment', async () => {
    (apiClient.post as Mock).mockResolvedValue({ data: { id: 'e-1', is_paid: true } });
    await payExpense(SID, 'e-1', { amount: 500000, payment_method: 'cash' } as any);
    expect(apiClient.post).toHaveBeenCalledWith(
      `${BASE}/${SID}/accounting/expenses/e-1/pay`,
      expect.objectContaining({ amount: 500000 }),
    );
  });

  it('deleteExpense calls delete', async () => {
    (apiClient.delete as Mock).mockResolvedValue({});
    await deleteExpense(SID, 'e-1');
    expect(apiClient.delete).toHaveBeenCalledWith(`${BASE}/${SID}/accounting/expenses/e-1`);
  });

  // --- Cash Register ---
  it('getTodayRegister calls today endpoint', async () => {
    (apiClient.get as Mock).mockResolvedValue({ data: { id: 'cr-1' } });
    await getTodayRegister(SID);
    expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/${SID}/accounting/cash-register/today`);
  });

  it('openCashRegister posts with balance', async () => {
    (apiClient.post as Mock).mockResolvedValue({ data: { id: 'cr-1' } });
    await openCashRegister(SID, '2026-04-10', 100000);
    expect(apiClient.post).toHaveBeenCalledWith(`${BASE}/${SID}/accounting/cash-register`, {
      school_id: SID, register_date: '2026-04-10', opening_balance: 100000,
    });
  });

  it('closeCashRegister posts closing balance', async () => {
    (apiClient.post as Mock).mockResolvedValue({ data: { id: 'cr-1', is_closed: true } });
    await closeCashRegister(SID, 'cr-1', 250000, 'Todo cuadra');
    expect(apiClient.post).toHaveBeenCalledWith(`${BASE}/${SID}/accounting/cash-register/cr-1/close`, {
      closing_balance: 250000, notes: 'Todo cuadra',
    });
  });

  // --- Balance Accounts ---
  it('getBalanceAccounts passes params', async () => {
    (apiClient.get as Mock).mockResolvedValue({ data: [{ id: 'ba-1' }] });
    const result = await getBalanceAccounts(SID, 'asset_current' as any, true);
    expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/${SID}/accounting/balance-accounts`, {
      params: { account_type: 'asset_current', is_active: true },
    });
    expect(result).toHaveLength(1);
  });

  it('createBalanceAccount posts data', async () => {
    (apiClient.post as Mock).mockResolvedValue({ data: { id: 'ba-2' } });
    await createBalanceAccount(SID, { name: 'Caja', account_type: 'asset_current' } as any);
    expect(apiClient.post).toHaveBeenCalledWith(`${BASE}/${SID}/accounting/balance-accounts`, expect.objectContaining({ name: 'Caja' }));
  });

  it('updateBalanceAccount patches data', async () => {
    (apiClient.patch as Mock).mockResolvedValue({ data: { id: 'ba-1' } });
    await updateBalanceAccount(SID, 'ba-1', { name: 'Caja Mayor' } as any);
    expect(apiClient.patch).toHaveBeenCalledWith(`${BASE}/${SID}/accounting/balance-accounts/ba-1`, { name: 'Caja Mayor' });
  });

  it('deleteBalanceAccount calls delete', async () => {
    (apiClient.delete as Mock).mockResolvedValue({});
    await deleteBalanceAccount(SID, 'ba-1');
    expect(apiClient.delete).toHaveBeenCalledWith(`${BASE}/${SID}/accounting/balance-accounts/ba-1`);
  });

  // --- Balance Entries ---
  it('getBalanceEntries returns paginated', async () => {
    (apiClient.get as Mock).mockResolvedValue({ data: paginatedOf([{ id: 'be-1' }]) });
    const result = await getBalanceEntries(SID, 'ba-1', '2026-04-01', '2026-04-30');
    expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/${SID}/accounting/balance-accounts/ba-1/entries`, {
      params: { start_date: '2026-04-01', end_date: '2026-04-30' },
    });
    expect(result.items).toHaveLength(1);
  });

  // --- Accounts Receivable ---
  it('getAccountsReceivable returns paginated', async () => {
    (apiClient.get as Mock).mockResolvedValue({ data: paginatedOf([{ id: 'ar-1' }]) });
    const result = await getAccountsReceivable(SID, { isPaid: false });
    expect(result.items).toHaveLength(1);
  });

  it('createAccountReceivable posts data', async () => {
    (apiClient.post as Mock).mockResolvedValue({ data: { id: 'ar-2' } });
    await createAccountReceivable(SID, { amount: 100000, client_id: 'c-1' } as any);
    expect(apiClient.post).toHaveBeenCalledWith(`${BASE}/${SID}/accounting/receivables`, expect.objectContaining({ amount: 100000 }));
  });

  it('payAccountReceivable posts payment', async () => {
    (apiClient.post as Mock).mockResolvedValue({ data: { id: 'ar-1' } });
    await payAccountReceivable(SID, 'ar-1', { amount: 50000 } as any);
    expect(apiClient.post).toHaveBeenCalledWith(`${BASE}/${SID}/accounting/receivables/ar-1/pay`, { amount: 50000 });
  });

  it('deleteAccountReceivable calls delete', async () => {
    (apiClient.delete as Mock).mockResolvedValue({});
    await deleteAccountReceivable(SID, 'ar-1');
    expect(apiClient.delete).toHaveBeenCalledWith(`${BASE}/${SID}/accounting/receivables/ar-1`);
  });

  // --- Accounts Payable ---
  it('getAccountsPayable returns paginated', async () => {
    (apiClient.get as Mock).mockResolvedValue({ data: paginatedOf([{ id: 'ap-1' }]) });
    const result = await getAccountsPayable(SID, { vendor: 'Proveedor X' });
    expect(result.items).toHaveLength(1);
  });

  it('createAccountPayable posts data', async () => {
    (apiClient.post as Mock).mockResolvedValue({ data: { id: 'ap-2' } });
    await createAccountPayable(SID, { amount: 200000, vendor: 'Proveedor X' } as any);
    expect(apiClient.post).toHaveBeenCalledWith(`${BASE}/${SID}/accounting/payables`, expect.objectContaining({ amount: 200000 }));
  });

  it('payAccountPayable posts payment', async () => {
    (apiClient.post as Mock).mockResolvedValue({ data: { id: 'ap-1' } });
    await payAccountPayable(SID, 'ap-1', { amount: 100000 } as any);
    expect(apiClient.post).toHaveBeenCalledWith(`${BASE}/${SID}/accounting/payables/ap-1/pay`, { amount: 100000 });
  });

  it('deleteAccountPayable calls delete', async () => {
    (apiClient.delete as Mock).mockResolvedValue({});
    await deleteAccountPayable(SID, 'ap-1');
    expect(apiClient.delete).toHaveBeenCalledWith(`${BASE}/${SID}/accounting/payables/ap-1`);
  });

  // --- Cash Balances & Caja Menor ---
  it('getCashBalances calls correct URL', async () => {
    (apiClient.get as Mock).mockResolvedValue({ data: { caja: null, banco: null, total_liquid: 0 } });
    const result = await getCashBalances(SID);
    expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/${SID}/accounting/cash-balances`);
    expect(result.total_liquid).toBe(0);
  });

  it('liquidateCajaMenor posts with params', async () => {
    (apiClient.post as Mock).mockResolvedValue({ data: { success: true, amount_liquidated: 50000 } });
    const result = await liquidateCajaMenor(SID, 50000, 'Liquidacion diaria');
    expect(apiClient.post).toHaveBeenCalledWith(
      `${BASE}/${SID}/accounting/caja-menor/liquidate`, null,
      { params: { amount: 50000, notes: 'Liquidacion diaria' } },
    );
    expect(result.success).toBe(true);
  });

  // --- Patrimony ---
  it('getPatrimonySummary calls correct URL', async () => {
    (apiClient.get as Mock).mockResolvedValue({ data: { summary: { net_patrimony: 5000000 } } });
    await getPatrimonySummary(SID);
    expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/${SID}/accounting/patrimony/summary`);
  });

  it('getInventoryValuation calls correct URL', async () => {
    (apiClient.get as Mock).mockResolvedValue({ data: { total_units: 500, total_value: 3000000 } });
    const result = await getInventoryValuation(SID);
    expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/${SID}/accounting/patrimony/inventory-valuation`);
    expect(result.total_units).toBe(500);
  });

  it('createDebt posts with params', async () => {
    const debtData = { name: 'Prestamo', amount: 1000000, creditor: 'Banco X' };
    (apiClient.post as Mock).mockResolvedValue({ data: { debt_id: 'd-1', ...debtData } });
    await createDebt(SID, debtData);
    expect(apiClient.post).toHaveBeenCalledWith(
      `${BASE}/${SID}/accounting/patrimony/debts`, null, { params: debtData },
    );
  });

  it('createFixedAsset posts with params', async () => {
    const assetData = { name: 'Maquina bordadora', value: 5000000 };
    (apiClient.post as Mock).mockResolvedValue({ data: { asset_id: 'fa-1', ...assetData } });
    await createFixedAsset(SID, assetData);
    expect(apiClient.post).toHaveBeenCalledWith(
      `${BASE}/${SID}/accounting/patrimony/fixed-assets`, null, { params: assetData },
    );
  });

  // --- Helper functions (pure, no API) ---
  describe('helper functions', () => {
    it('getExpenseCategoryLabel returns correct label', () => {
      expect(getExpenseCategoryLabel('rent' as any)).toBe('Arriendo');
      expect(getExpenseCategoryLabel('payroll' as any)).toBe('Nómina');
    });

    it('getExpenseCategoryLabel returns key for unknown category', () => {
      expect(getExpenseCategoryLabel('unknown_cat' as any)).toBe('unknown_cat');
    });

    it('getExpenseCategoryColor returns CSS classes', () => {
      expect(getExpenseCategoryColor('rent' as any)).toContain('bg-purple');
    });

    it('getExpenseCategoryColor returns default for unknown', () => {
      expect(getExpenseCategoryColor('xyz' as any)).toContain('bg-stone');
    });

    it('getPaymentMethodLabel returns correct label', () => {
      expect(getPaymentMethodLabel('cash')).toBe('Efectivo');
      expect(getPaymentMethodLabel('nequi')).toBe('Nequi');
    });

    it('getPaymentMethodLabel returns key for unknown method', () => {
      expect(getPaymentMethodLabel('crypto')).toBe('crypto');
    });

    it('getAccountTypeLabel returns correct label', () => {
      expect(getAccountTypeLabel('asset_current' as any)).toBe('Activo Corriente');
      expect(getAccountTypeLabel('liability_current' as any)).toBe('Pasivo Corriente');
    });

    it('getAccountTypeColor returns CSS classes', () => {
      expect(getAccountTypeColor('asset_current' as any)).toContain('bg-emerald');
    });

    it('getAccountTypeCategory classifies correctly', () => {
      expect(getAccountTypeCategory('asset_current' as any)).toBe('assets');
      expect(getAccountTypeCategory('asset_fixed' as any)).toBe('assets');
      expect(getAccountTypeCategory('liability_current' as any)).toBe('liabilities');
      expect(getAccountTypeCategory('equity_capital' as any)).toBe('equity');
    });
  });

  // --- Error propagation ---
  describe('error propagation', () => {
    it('propagates from getTransactions', async () => {
      (apiClient.get as Mock).mockRejectedValue(new Error('Server error'));
      await expect(getTransactions(SID)).rejects.toThrow('Server error');
    });

    it('propagates from createExpense', async () => {
      (apiClient.post as Mock).mockRejectedValue(new Error('Validation error'));
      await expect(createExpense(SID, {} as any)).rejects.toThrow('Validation error');
    });
  });
});
