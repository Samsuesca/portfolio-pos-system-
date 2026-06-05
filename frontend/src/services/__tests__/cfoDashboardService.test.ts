import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import apiClient from '../../utils/api-client';
import cfoDashboardService, {
  getHealthMetrics, getHealthStatusColorClass, getHealthStatusTextClass,
  getAlertColorClass, getAlertIconClass, formatCFOCurrency, getDSCRStatus, getRunwayStatus,
} from '../cfoDashboardService';

vi.mock('../../utils/api-client', () => ({
  default: { get: vi.fn() },
}));

const apiMock = vi.mocked(apiClient);

describe('cfoDashboardService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('getHealthMetrics', () => {
    it('fetches CFO health metrics', async () => {
      const mockMetrics = { as_of: '2026-01-01', health_status: { status: 'healthy' } };
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockMetrics });
      const result = await getHealthMetrics();
      expect(apiMock.get).toHaveBeenCalledWith('/cfo-dashboard/health-metrics');
      expect(result.health_status.status).toBe('healthy');
    });
  });

  describe('getHealthStatusColorClass', () => {
    it('maps known colors to Tailwind classes', () => {
      expect(getHealthStatusColorClass('green')).toBe('bg-green-500');
      expect(getHealthStatusColorClass('yellow')).toBe('bg-yellow-500');
      expect(getHealthStatusColorClass('orange')).toBe('bg-orange-500');
      expect(getHealthStatusColorClass('red')).toBe('bg-red-500');
    });
    it('returns stone for unknown colors', () => {
      expect(getHealthStatusColorClass('purple')).toBe('bg-stone-500');
    });
  });

  describe('getHealthStatusTextClass', () => {
    it('maps known colors to text classes', () => {
      expect(getHealthStatusTextClass('green')).toBe('text-green-600');
      expect(getHealthStatusTextClass('red')).toBe('text-red-600');
    });
    it('returns stone for unknown colors', () => {
      expect(getHealthStatusTextClass('unknown')).toBe('text-stone-600');
    });
  });

  describe('getAlertColorClass', () => {
    it('returns red classes for critical', () => {
      expect(getAlertColorClass('critical')).toContain('red');
    });
    it('returns amber classes for warning', () => {
      expect(getAlertColorClass('warning')).toContain('amber');
    });
  });

  describe('getAlertIconClass', () => {
    it('returns red for critical', () => {
      expect(getAlertIconClass('critical')).toBe('text-red-500');
    });
    it('returns amber for warning', () => {
      expect(getAlertIconClass('warning')).toBe('text-amber-500');
    });
  });

  describe('formatCFOCurrency', () => {
    it('formats millions', () => {
      expect(formatCFOCurrency(5000000)).toBe('$5.0M');
      expect(formatCFOCurrency(1500000)).toBe('$1.5M');
    });
    it('formats thousands', () => {
      expect(formatCFOCurrency(50000)).toBe('$50K');
      expect(formatCFOCurrency(1000)).toBe('$1K');
    });
    it('formats small values', () => {
      expect(formatCFOCurrency(500)).toContain('500');
    });
  });

  describe('getDSCRStatus', () => {
    it('returns Excelente for ratio >= 2', () => {
      expect(getDSCRStatus(2.5)).toEqual({ status: 'Excelente', color: 'green' });
    });
    it('returns Saludable for ratio >= 1.25', () => {
      expect(getDSCRStatus(1.5)).toEqual({ status: 'Saludable', color: 'green' });
    });
    it('returns Adecuado for ratio >= 1', () => {
      expect(getDSCRStatus(1.1)).toEqual({ status: 'Adecuado', color: 'yellow' });
    });
    it('returns Critico for ratio < 1', () => {
      expect(getDSCRStatus(0.8)).toEqual({ status: 'Critico', color: 'red' });
    });
  });

  describe('getRunwayStatus', () => {
    it('returns Excelente for >= 90 days', () => {
      expect(getRunwayStatus(100)).toEqual({ status: 'Excelente', color: 'green' });
    });
    it('returns Saludable for >= 60 days', () => {
      expect(getRunwayStatus(75)).toEqual({ status: 'Saludable', color: 'green' });
    });
    it('returns Aceptable for >= 30 days', () => {
      expect(getRunwayStatus(45)).toEqual({ status: 'Aceptable', color: 'yellow' });
    });
    it('returns Bajo for >= 15 days', () => {
      expect(getRunwayStatus(20)).toEqual({ status: 'Bajo', color: 'orange' });
    });
    it('returns Critico for < 15 days', () => {
      expect(getRunwayStatus(10)).toEqual({ status: 'Critico', color: 'red' });
    });
  });

  describe('default export', () => {
    it('exports all functions', () => {
      expect(cfoDashboardService.getHealthMetrics).toBe(getHealthMetrics);
      expect(cfoDashboardService.formatCFOCurrency).toBe(formatCFOCurrency);
    });
  });
});
