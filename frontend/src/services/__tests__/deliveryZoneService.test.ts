import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import apiClient from '../../utils/api-client';
import { deliveryZoneService } from '../deliveryZoneService';

vi.mock('../../utils/api-client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const apiMock = vi.mocked(apiClient);

const mockZone = {
  id: 'zone-1',
  name: 'Bogota Centro',
  description: 'Zona centro de Bogota',
  delivery_fee: 8000,
  estimated_days: 2,
  is_active: true,
  created_at: '2026-01-01T00:00:00',
  updated_at: '2026-01-01T00:00:00',
};

describe('deliveryZoneService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getZones', () => {
    it('fetches all zones including inactive by default', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: [mockZone] });

      const result = await deliveryZoneService.getZones();

      expect(apiMock.get).toHaveBeenCalledWith('/delivery-zones', { params: { include_inactive: true } });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Bogota Centro');
    });

    it('fetches only active zones when includeInactive is false', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: [mockZone] });

      await deliveryZoneService.getZones(false);

      expect(apiMock.get).toHaveBeenCalledWith('/delivery-zones', { params: { include_inactive: false } });
    });

    it('propagates API errors', async () => {
      (apiMock.get as Mock).mockRejectedValueOnce(new Error('Server error'));

      await expect(deliveryZoneService.getZones()).rejects.toThrow('Server error');
    });
  });

  describe('getZone', () => {
    it('fetches a single zone by ID', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockZone });

      const result = await deliveryZoneService.getZone('zone-1');

      expect(apiMock.get).toHaveBeenCalledWith('/delivery-zones/zone-1');
      expect(result.id).toBe('zone-1');
    });
  });

  describe('createZone', () => {
    it('posts a new zone', async () => {
      const createData = { name: 'Bogota Norte', delivery_fee: 10000, estimated_days: 3 };
      (apiMock.post as Mock).mockResolvedValueOnce({ data: { ...mockZone, ...createData, id: 'zone-2' } });

      const result = await deliveryZoneService.createZone(createData as never);

      expect(apiMock.post).toHaveBeenCalledWith('/delivery-zones', createData);
      expect(result.name).toBe('Bogota Norte');
    });
  });

  describe('updateZone', () => {
    it('patches an existing zone', async () => {
      const updateData = { delivery_fee: 12000 };
      (apiMock.patch as Mock).mockResolvedValueOnce({ data: { ...mockZone, ...updateData } });

      const result = await deliveryZoneService.updateZone('zone-1', updateData);

      expect(apiMock.patch).toHaveBeenCalledWith('/delivery-zones/zone-1', updateData);
      expect(result.delivery_fee).toBe(12000);
    });
  });

  describe('deleteZone', () => {
    it('deletes a zone', async () => {
      (apiMock.delete as Mock).mockResolvedValueOnce({});

      await deliveryZoneService.deleteZone('zone-1');

      expect(apiMock.delete).toHaveBeenCalledWith('/delivery-zones/zone-1');
    });
  });
});
