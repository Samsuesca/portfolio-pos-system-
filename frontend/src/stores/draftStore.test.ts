import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDraftStore, formatDraftLabel, getTimeAgo, type Draft, type SaleDraft, type OrderDraft } from './draftStore';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeSaleDraftData(): Omit<SaleDraft, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    type: 'sale',
    schoolId: 'school-1',
    clientId: 'client-1',
    clientName: 'Juan',
    notes: '',
    isHistorical: false,
    items: [],
    payments: [],
    total: 0,
  };
}

function makeOrderDraftData(): Omit<OrderDraft, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    type: 'order',
    schoolId: 'school-1',
    clientId: 'client-1',
    deliveryDate: '2024-12-31',
    notes: '',
    advancePayment: 0,
    advancePaymentMethod: 'cash',
    activeTab: 'catalog',
    items: [],
    total: 0,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useDraftStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    act(() => {
      useDraftStore.setState({ drafts: [], activeDraftId: null });
    });
  });

  describe('addDraft', () => {
    it('creates a draft and returns its generated id', () => {
      const { result } = renderHook(() => useDraftStore());
      let id: string;
      act(() => {
        id = result.current.addDraft(makeSaleDraftData());
      });
      expect(typeof id!).toBe('string');
      expect(id!.startsWith('draft-')).toBe(true);
      expect(result.current.drafts).toHaveLength(1);
    });

    it('assigns createdAt and updatedAt to the new draft', () => {
      const { result } = renderHook(() => useDraftStore());
      let id: string;
      act(() => {
        id = result.current.addDraft(makeSaleDraftData());
      });
      const draft = result.current.getDraft(id!);
      expect(draft?.createdAt).toBeTruthy();
      expect(draft?.updatedAt).toBeTruthy();
      expect(new Date(draft!.createdAt).getTime()).not.toBeNaN();
    });

    it('throws when MAX_DRAFTS (5) is reached', () => {
      const { result } = renderHook(() => useDraftStore());
      act(() => {
        for (let i = 0; i < 5; i++) {
          result.current.addDraft(makeSaleDraftData());
        }
      });
      expect(() => {
        act(() => { result.current.addDraft(makeSaleDraftData()); });
      }).toThrow('Máximo 5 borradores');
    });
  });

  describe('updateDraft', () => {
    it('updates specified fields and refreshes updatedAt', async () => {
      const { result } = renderHook(() => useDraftStore());
      let id: string;
      act(() => { id = result.current.addDraft(makeSaleDraftData()); });

      const originalUpdatedAt = result.current.getDraft(id!)?.updatedAt;

      await new Promise(r => setTimeout(r, 5)); // ensure different timestamp

      act(() => { result.current.updateDraft(id!, { notes: 'nuevo' }); });

      const updated = result.current.getDraft(id!);
      expect(updated?.notes).toBe('nuevo');
      expect(updated?.updatedAt).not.toBe(originalUpdatedAt);
    });

    it('is a no-op for unknown id', () => {
      const { result } = renderHook(() => useDraftStore());
      act(() => { result.current.addDraft(makeSaleDraftData()); });
      const before = result.current.drafts.length;
      act(() => { result.current.updateDraft('unknown-id', { notes: 'x' }); });
      expect(result.current.drafts.length).toBe(before);
    });
  });

  describe('removeDraft', () => {
    it('removes the draft from the list', () => {
      const { result } = renderHook(() => useDraftStore());
      let id: string;
      act(() => { id = result.current.addDraft(makeSaleDraftData()); });
      act(() => { result.current.removeDraft(id!); });
      expect(result.current.drafts).toHaveLength(0);
    });

    it('clears activeDraftId when the active draft is removed', () => {
      const { result } = renderHook(() => useDraftStore());
      let id: string;
      act(() => {
        id = result.current.addDraft(makeSaleDraftData());
        result.current.setActiveDraft(id);
      });
      act(() => { result.current.removeDraft(id!); });
      expect(result.current.activeDraftId).toBeNull();
    });

    it('preserves activeDraftId when a different draft is removed', () => {
      const { result } = renderHook(() => useDraftStore());
      let id1: string, id2: string;
      act(() => {
        id1 = result.current.addDraft(makeSaleDraftData());
        id2 = result.current.addDraft(makeOrderDraftData());
        result.current.setActiveDraft(id1);
      });
      act(() => { result.current.removeDraft(id2!); });
      expect(result.current.activeDraftId).toBe(id1!);
    });
  });

  describe('getDraft', () => {
    it('returns the draft by id', () => {
      const { result } = renderHook(() => useDraftStore());
      let id: string;
      act(() => { id = result.current.addDraft(makeSaleDraftData()); });
      const draft = result.current.getDraft(id!);
      expect(draft?.id).toBe(id!);
    });

    it('returns undefined for unknown id', () => {
      const { result } = renderHook(() => useDraftStore());
      expect(result.current.getDraft('nonexistent')).toBeUndefined();
    });
  });

  describe('setActiveDraft', () => {
    it('sets the active draft id', () => {
      const { result } = renderHook(() => useDraftStore());
      let id: string;
      act(() => { id = result.current.addDraft(makeSaleDraftData()); });
      act(() => { result.current.setActiveDraft(id!); });
      expect(result.current.activeDraftId).toBe(id!);
    });

    it('clears the active draft id when passed null', () => {
      const { result } = renderHook(() => useDraftStore());
      let id: string;
      act(() => {
        id = result.current.addDraft(makeSaleDraftData());
        result.current.setActiveDraft(id);
      });
      act(() => { result.current.setActiveDraft(null); });
      expect(result.current.activeDraftId).toBeNull();
    });
  });

  describe('clearAllDrafts', () => {
    it('empties the drafts array and clears activeDraftId', () => {
      const { result } = renderHook(() => useDraftStore());
      let id: string;
      act(() => {
        id = result.current.addDraft(makeSaleDraftData());
        result.current.addDraft(makeOrderDraftData());
        result.current.setActiveDraft(id);
      });
      act(() => { result.current.clearAllDrafts(); });
      expect(result.current.drafts).toHaveLength(0);
      expect(result.current.activeDraftId).toBeNull();
    });
  });

  describe('computed getters', () => {
    it('hasDrafts returns false when no drafts', () => {
      const { result } = renderHook(() => useDraftStore());
      expect(result.current.hasDrafts()).toBe(false);
    });

    it('hasDrafts returns true when at least one draft exists', () => {
      const { result } = renderHook(() => useDraftStore());
      act(() => { result.current.addDraft(makeSaleDraftData()); });
      expect(result.current.hasDrafts()).toBe(true);
    });

    it('getDraftCount returns correct count', () => {
      const { result } = renderHook(() => useDraftStore());
      act(() => {
        result.current.addDraft(makeSaleDraftData());
        result.current.addDraft(makeOrderDraftData());
      });
      expect(result.current.getDraftCount()).toBe(2);
    });

    it('canAddDraft returns true when below limit', () => {
      const { result } = renderHook(() => useDraftStore());
      expect(result.current.canAddDraft()).toBe(true);
    });

    it('canAddDraft returns false when at limit', () => {
      const { result } = renderHook(() => useDraftStore());
      act(() => {
        for (let i = 0; i < 5; i++) {
          result.current.addDraft(makeSaleDraftData());
        }
      });
      expect(result.current.canAddDraft()).toBe(false);
    });
  });
});

// ─── formatDraftLabel ─────────────────────────────────────────────────────────

describe('formatDraftLabel', () => {
  const baseSale: SaleDraft = {
    id: 'x',
    type: 'sale',
    createdAt: '',
    updatedAt: '',
    schoolId: 's',
    clientId: 'c',
    notes: '',
    isHistorical: false,
    items: [],
    payments: [],
    total: 50000,
  };

  const baseOrder: OrderDraft = {
    id: 'x',
    type: 'order',
    createdAt: '',
    updatedAt: '',
    schoolId: 's',
    clientId: 'c',
    deliveryDate: '',
    notes: '',
    advancePayment: 0,
    advancePaymentMethod: 'cash',
    activeTab: 'catalog',
    items: [],
    total: 0,
  };

  it('formats a sale draft with singular item', () => {
    const draft: Draft = {
      ...baseSale,
      items: [{ tempId: '1', productName: 'X', size: 'M', quantity: 1, unitPrice: 50000 }],
    };
    const label = formatDraftLabel(draft);
    expect(label).toContain('Venta');
    expect(label).toContain('1 item');
    expect(label).not.toContain('items');
  });

  it('formats a sale draft with plural items', () => {
    const draft: Draft = {
      ...baseSale,
      items: [
        { tempId: '1', productName: 'X', size: 'M', quantity: 1, unitPrice: 50000 },
        { tempId: '2', productName: 'Y', size: 'L', quantity: 1, unitPrice: 0 },
      ],
    };
    const label = formatDraftLabel(draft);
    expect(label).toContain('2 items');
  });

  it('formats an order draft', () => {
    const draft: Draft = {
      ...baseOrder,
      items: [{ tempId: '1', productName: 'X', size: 'M', quantity: 1, unitPrice: 0 }],
    };
    const label = formatDraftLabel(draft);
    expect(label).toContain('Encargo');
    expect(label).toContain('1 item');
  });

  it('formats an order draft with plural items', () => {
    const draft: Draft = {
      ...baseOrder,
      items: [
        { tempId: '1', productName: 'X', size: 'M', quantity: 1, unitPrice: 0 },
        { tempId: '2', productName: 'Y', size: 'L', quantity: 1, unitPrice: 0 },
      ],
    };
    const label = formatDraftLabel(draft);
    expect(label).toContain('2 items');
  });
});

// ─── getTimeAgo ───────────────────────────────────────────────────────────────

describe('getTimeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "hace un momento" for less than 1 minute ago', () => {
    const recent = new Date('2024-01-15T11:59:30.000Z').toISOString();
    expect(getTimeAgo(recent)).toBe('hace un momento');
  });

  it('returns minutes for 1-59 minutes ago', () => {
    const thirtyMinsAgo = new Date('2024-01-15T11:30:00.000Z').toISOString();
    expect(getTimeAgo(thirtyMinsAgo)).toBe('hace 30 min');
  });

  it('returns hours for 1-23 hours ago', () => {
    const threeHoursAgo = new Date('2024-01-15T09:00:00.000Z').toISOString();
    expect(getTimeAgo(threeHoursAgo)).toBe('hace 3h');
  });

  it('returns days for 24+ hours ago', () => {
    const twoDaysAgo = new Date('2024-01-13T12:00:00.000Z').toISOString();
    expect(getTimeAgo(twoDaysAgo)).toBe('hace 2d');
  });

  it('returns exactly 1 minute for boundary', () => {
    const exactly1Min = new Date('2024-01-15T11:59:00.000Z').toISOString();
    expect(getTimeAgo(exactly1Min)).toBe('hace 1 min');
  });
});
