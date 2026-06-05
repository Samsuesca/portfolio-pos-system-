import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import apiClient from '../../utils/api-client';
import {
  getEmployees,
  getMyEmployee,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getEmployeeTotals,
  getEmployeeBonuses,
  createEmployeeBonus,
  updateEmployeeBonus,
  deleteEmployeeBonus,
  getPaymentFrequencyLabel,
  getBonusTypeLabel,
} from '../employeeService';
import type {
  EmployeeListItem,
  EmployeeResponse,
  EmployeeTotals,
  EmployeeBonusResponse,
} from '../employeeService';

vi.mock('../../utils/api-client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const apiMock = vi.mocked(apiClient);

function paginatedOf<T>(items: T[]) {
  return { items, total: items.length, skip: 0, limit: 100, page: 1, total_pages: 1, has_more: false };
}

const BASE_URL = '/global/employees';

const sampleListItem: EmployeeListItem = {
  id: 'emp-1',
  full_name: 'Maria Lopez',
  document_id: '1234567890',
  position: 'Vendedora',
  hire_date: '2025-01-15',
  base_salary: 1_300_000,
  payment_frequency: 'monthly',
  is_active: true,
};

const sampleResponse: EmployeeResponse = {
  ...sampleListItem,
  document_type: 'CC',
  email: 'maria@test.com',
  phone: '3001234567',
  address: 'Calle 1',
  termination_date: null,
  payment_method: 'transfer',
  bank_name: 'Bancolombia',
  bank_account: '12345678',
  health_deduction: 52_000,
  pension_deduction: 52_000,
  other_deductions: 0,
  total_deductions: 104_000,
  user_id: null,
  created_by: 'admin-1',
  created_at: '2025-01-15T00:00:00',
  updated_at: '2026-04-01T00:00:00',
};

describe('employeeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getEmployees', () => {
    it('fetches paginated list with filters', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([sampleListItem]) });

      const result = await getEmployees({ is_active: true, limit: 50 });

      expect(apiMock.get).toHaveBeenCalledWith(BASE_URL, { params: { is_active: true, limit: 50 } });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].full_name).toBe('Maria Lopez');
    });

    it('wraps plain array into paginated response', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: [sampleListItem] });

      const result = await getEmployees();

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('getMyEmployee', () => {
    it('fetches current user employee record', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: sampleResponse });

      const result = await getMyEmployee();

      expect(apiMock.get).toHaveBeenCalledWith(`${BASE_URL}/me`);
      expect(result.full_name).toBe('Maria Lopez');
    });
  });

  describe('getEmployee', () => {
    it('fetches single employee by id', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: sampleResponse });

      const result = await getEmployee('emp-1');

      expect(apiMock.get).toHaveBeenCalledWith(`${BASE_URL}/emp-1`);
      expect(result.document_type).toBe('CC');
    });
  });

  describe('createEmployee', () => {
    it('posts new employee', async () => {
      (apiMock.post as Mock).mockResolvedValueOnce({ data: sampleResponse });

      const result = await createEmployee({
        full_name: 'Maria Lopez',
        document_id: '1234567890',
        position: 'Vendedora',
        hire_date: '2025-01-15',
        base_salary: 1_300_000,
      });

      expect(apiMock.post).toHaveBeenCalledWith(BASE_URL, expect.objectContaining({ full_name: 'Maria Lopez' }));
      expect(result.id).toBe('emp-1');
    });
  });

  describe('updateEmployee', () => {
    it('patches employee by id', async () => {
      const updated = { ...sampleResponse, base_salary: 1_500_000 };
      (apiMock.patch as Mock).mockResolvedValueOnce({ data: updated });

      const result = await updateEmployee('emp-1', { base_salary: 1_500_000 });

      expect(apiMock.patch).toHaveBeenCalledWith(`${BASE_URL}/emp-1`, { base_salary: 1_500_000 });
      expect(result.base_salary).toBe(1_500_000);
    });
  });

  describe('deleteEmployee', () => {
    it('deletes by id', async () => {
      (apiMock.delete as Mock).mockResolvedValueOnce({});

      await deleteEmployee('emp-1');

      expect(apiMock.delete).toHaveBeenCalledWith(`${BASE_URL}/emp-1`);
    });
  });

  describe('getEmployeeTotals', () => {
    it('fetches calculated totals', async () => {
      const totals: EmployeeTotals = {
        base_salary: 1_300_000,
        total_bonuses: 200_000,
        total_deductions: 104_000,
        net_amount: 1_396_000,
        bonus_breakdown: [{ name: 'Transporte', amount: 200_000 }],
        deduction_breakdown: [{ name: 'Salud', amount: 52_000 }, { name: 'Pension', amount: 52_000 }],
      };
      (apiMock.get as Mock).mockResolvedValueOnce({ data: totals });

      const result = await getEmployeeTotals('emp-1');

      expect(apiMock.get).toHaveBeenCalledWith(`${BASE_URL}/emp-1/totals`);
      expect(result.net_amount).toBe(1_396_000);
    });
  });

  describe('getEmployeeBonuses', () => {
    it('fetches paginated bonuses for employee', async () => {
      const bonus: EmployeeBonusResponse = {
        id: 'bonus-1',
        employee_id: 'emp-1',
        name: 'Transporte',
        bonus_type: 'fixed',
        amount: 200_000,
        is_recurring: true,
        start_date: '2025-02-01',
        end_date: null,
        is_active: true,
        notes: null,
        created_at: '2025-02-01T00:00:00',
        updated_at: '2025-02-01T00:00:00',
      };
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([bonus]) });

      const result = await getEmployeeBonuses('emp-1', { is_active: true });

      expect(apiMock.get).toHaveBeenCalledWith(`${BASE_URL}/emp-1/bonuses`, { params: { is_active: true } });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('Transporte');
    });
  });

  describe('createEmployeeBonus', () => {
    it('posts new bonus for employee', async () => {
      const bonus: EmployeeBonusResponse = {
        id: 'bonus-2',
        employee_id: 'emp-1',
        name: 'Comision',
        bonus_type: 'variable',
        amount: 100_000,
        is_recurring: false,
        start_date: '2026-04-01',
        end_date: null,
        is_active: true,
        notes: null,
        created_at: '2026-04-01T00:00:00',
        updated_at: '2026-04-01T00:00:00',
      };
      (apiMock.post as Mock).mockResolvedValueOnce({ data: bonus });

      const result = await createEmployeeBonus('emp-1', {
        name: 'Comision',
        bonus_type: 'variable',
        amount: 100_000,
        start_date: '2026-04-01',
      });

      expect(apiMock.post).toHaveBeenCalledWith(`${BASE_URL}/emp-1/bonuses`, expect.objectContaining({ name: 'Comision' }));
      expect(result.id).toBe('bonus-2');
    });
  });

  describe('updateEmployeeBonus', () => {
    it('patches bonus by bonus id', async () => {
      const updated: EmployeeBonusResponse = {
        id: 'bonus-1',
        employee_id: 'emp-1',
        name: 'Transporte',
        bonus_type: 'fixed',
        amount: 250_000,
        is_recurring: true,
        start_date: '2025-02-01',
        end_date: null,
        is_active: true,
        notes: null,
        created_at: '2025-02-01T00:00:00',
        updated_at: '2026-04-12T00:00:00',
      };
      (apiMock.patch as Mock).mockResolvedValueOnce({ data: updated });

      const result = await updateEmployeeBonus('bonus-1', { amount: 250_000 });

      expect(apiMock.patch).toHaveBeenCalledWith(`${BASE_URL}/bonuses/bonus-1`, { amount: 250_000 });
      expect(result.amount).toBe(250_000);
    });
  });

  describe('deleteEmployeeBonus', () => {
    it('deletes bonus by id', async () => {
      (apiMock.delete as Mock).mockResolvedValueOnce({});

      await deleteEmployeeBonus('bonus-1');

      expect(apiMock.delete).toHaveBeenCalledWith(`${BASE_URL}/bonuses/bonus-1`);
    });
  });

  describe('error propagation', () => {
    it('propagates API errors from getEmployee', async () => {
      (apiMock.get as Mock).mockRejectedValueOnce(new Error('Not found'));

      await expect(getEmployee('bad-id')).rejects.toThrow('Not found');
    });
  });

  describe('helper functions', () => {
    describe('getPaymentFrequencyLabel', () => {
      it('returns correct labels', () => {
        expect(getPaymentFrequencyLabel('daily')).toBe('Diario');
        expect(getPaymentFrequencyLabel('weekly')).toBe('Semanal');
        expect(getPaymentFrequencyLabel('biweekly')).toBe('Quincenal');
        expect(getPaymentFrequencyLabel('monthly')).toBe('Mensual');
      });
    });

    describe('getBonusTypeLabel', () => {
      it('returns correct labels', () => {
        expect(getBonusTypeLabel('fixed')).toBe('Fijo');
        expect(getBonusTypeLabel('variable')).toBe('Variable');
        expect(getBonusTypeLabel('one_time')).toBe('Único');
      });
    });
  });
});
