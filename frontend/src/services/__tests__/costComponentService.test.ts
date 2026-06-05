import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import apiClient from '../../utils/api-client';
import { getTemplates, createTemplate, getBreakdown, upsertBreakdown, bulkApplyComponent } from '../costComponentService';

vi.mock('../../utils/api-client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

const apiMock = vi.mocked(apiClient);

const mockTemplate = { id: 't-1', garment_type_id: 'gt-1', name: 'Tela', code: 'TELA', is_variable: false, display_order: 1, is_active: true };
const mockBreakdown = { product_id: 'p-1', product_code: 'P001', total_cost: 15000, margin_percent: 70, components: [], has_estimates: false };

describe('costComponentService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('getTemplates', () => {
    it('fetches school-scoped templates', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: [mockTemplate] });
      const result = await getTemplates('gt-1', 'school-1');
      expect(apiMock.get).toHaveBeenCalledWith('/schools/school-1/garment-types/gt-1/cost-templates');
      expect(result).toHaveLength(1);
    });

    it('fetches global templates when isGlobal=true', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: [mockTemplate] });
      await getTemplates('gt-1', undefined, true);
      expect(apiMock.get).toHaveBeenCalledWith('/global-garment-types/gt-1/cost-templates');
    });
  });

  describe('createTemplate', () => {
    it('posts school-scoped template', async () => {
      (apiMock.post as Mock).mockResolvedValueOnce({ data: mockTemplate });
      const data = { name: 'Tela', code: 'TELA', is_variable: false, display_order: 1 };
      await createTemplate('gt-1', data, 'school-1');
      expect(apiMock.post).toHaveBeenCalledWith('/schools/school-1/garment-types/gt-1/cost-templates', data);
    });

    it('posts global template when isGlobal=true', async () => {
      (apiMock.post as Mock).mockResolvedValueOnce({ data: mockTemplate });
      const data = { name: 'Tela', code: 'TELA', is_variable: false, display_order: 1 };
      await createTemplate('gt-1', data, undefined, true);
      expect(apiMock.post).toHaveBeenCalledWith('/global-garment-types/gt-1/cost-templates', data);
    });
  });

  describe('getBreakdown', () => {
    it('fetches school-scoped breakdown', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockBreakdown });
      const result = await getBreakdown('p-1', 'school-1');
      expect(apiMock.get).toHaveBeenCalledWith('/schools/school-1/products/p-1/cost-breakdown');
      expect(result.total_cost).toBe(15000);
    });

    it('fetches global breakdown when isGlobal=true', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockBreakdown });
      await getBreakdown('p-1', undefined, true);
      expect(apiMock.get).toHaveBeenCalledWith('/global-products/p-1/cost-breakdown');
    });
  });

  describe('upsertBreakdown', () => {
    it('puts components for school product', async () => {
      (apiMock.put as Mock).mockResolvedValueOnce({ data: mockBreakdown });
      const comps = [{ template_id: 't-1', amount: 5000 }];
      await upsertBreakdown('p-1', comps, 'school-1');
      expect(apiMock.put).toHaveBeenCalledWith('/schools/school-1/products/p-1/cost-breakdown', { components: comps });
    });

    it('puts components for global product', async () => {
      (apiMock.put as Mock).mockResolvedValueOnce({ data: mockBreakdown });
      await upsertBreakdown('p-1', [], undefined, true);
      expect(apiMock.put).toHaveBeenCalledWith('/global-products/p-1/cost-breakdown', { components: [] });
    });
  });

  describe('bulkApplyComponent', () => {
    it('puts bulk apply for school garment type', async () => {
      (apiMock.put as Mock).mockResolvedValueOnce({ data: { updated: 5, total_cost_recalculated: 5 } });
      const result = await bulkApplyComponent('gt-1', 'TELA', 5000, [{ sizes: ['S', 'M'], delta: 500 }], 'Tela base', 'school-1');
      expect(apiMock.put).toHaveBeenCalledWith('/schools/school-1/garment-types/gt-1/bulk-cost-component', {
        code: 'TELA', amount: 5000, notes: 'Tela base', size_deltas: [{ sizes: ['S', 'M'], delta: 500 }],
      });
      expect(result.updated).toBe(5);
    });

    it('puts bulk apply for global garment type', async () => {
      (apiMock.put as Mock).mockResolvedValueOnce({ data: { updated: 3, total_cost_recalculated: 3 } });
      await bulkApplyComponent('gt-1', 'TELA', 5000, [], undefined, undefined, true);
      expect(apiMock.put).toHaveBeenCalledWith('/global-garment-types/gt-1/bulk-cost-component', {
        code: 'TELA', amount: 5000, notes: undefined, size_deltas: [],
      });
    });
  });
});
