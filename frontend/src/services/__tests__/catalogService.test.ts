import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import apiClient from '../../utils/api-client';
import { catalogService } from '../catalogService';
import type { Position } from '../catalogService';

vi.mock('../../utils/api-client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const apiMock = vi.mocked(apiClient);

const mockPosition: Position = {
  id: 'pos-1',
  code: 'MANGA_CORTA',
  name: 'Manga Corta',
  description: 'Prenda con manga corta',
  is_active: true,
  sort_order: 1,
  created_at: '2026-01-01T00:00:00',
  updated_at: '2026-01-01T00:00:00',
};

describe('catalogService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPositions', () => {
    it('fetches active positions by default', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: [mockPosition] });

      const result = await catalogService.getPositions();

      expect(apiMock.get).toHaveBeenCalledWith('/global/catalog/positions', {
        params: { include_inactive: false },
      });
      expect(result).toEqual([mockPosition]);
    });

    it('fetches all positions when includeInactive is true', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: [mockPosition] });

      await catalogService.getPositions(true);

      expect(apiMock.get).toHaveBeenCalledWith('/global/catalog/positions', {
        params: { include_inactive: true },
      });
    });

    it('returns empty array when no positions exist', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: [] });

      const result = await catalogService.getPositions();

      expect(result).toEqual([]);
    });
  });

  describe('createPosition', () => {
    it('creates a new position with required fields', async () => {
      const input = { code: 'CUELLO_V', name: 'Cuello V' };
      (apiMock.post as Mock).mockResolvedValueOnce({ data: { ...mockPosition, ...input, id: 'pos-2' } });

      const result = await catalogService.createPosition(input);

      expect(apiMock.post).toHaveBeenCalledWith('/global/catalog/positions', input);
      expect(result.code).toBe('CUELLO_V');
    });

    it('creates a position with optional description', async () => {
      const input = { code: 'BOLSILLO', name: 'Bolsillo', description: 'Bolsillo frontal' };
      (apiMock.post as Mock).mockResolvedValueOnce({ data: { ...mockPosition, ...input, id: 'pos-3' } });

      const result = await catalogService.createPosition(input);

      expect(apiMock.post).toHaveBeenCalledWith('/global/catalog/positions', input);
      expect(result.description).toBe('Bolsillo frontal');
    });
  });

  describe('updatePosition', () => {
    it('patches a position with partial data', async () => {
      const update = { name: 'Manga Larga', sort_order: 5 };
      (apiMock.patch as Mock).mockResolvedValueOnce({ data: { ...mockPosition, ...update } });

      const result = await catalogService.updatePosition('pos-1', update);

      expect(apiMock.patch).toHaveBeenCalledWith('/global/catalog/positions/pos-1', update);
      expect(result.name).toBe('Manga Larga');
      expect(result.sort_order).toBe(5);
    });
  });

  describe('deletePosition', () => {
    it('deletes a position by id', async () => {
      (apiMock.delete as Mock).mockResolvedValueOnce({});

      await catalogService.deletePosition('pos-1');

      expect(apiMock.delete).toHaveBeenCalledWith('/global/catalog/positions/pos-1');
    });
  });
});
