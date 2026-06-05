import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSchoolId, useSchoolIdOrNull } from './useSchoolId';

vi.mock('../stores/schoolStore', () => ({
  useSchoolStore: vi.fn(),
}));

import { useSchoolStore } from '../stores/schoolStore';
const useSchoolStoreMock = vi.mocked(useSchoolStore);

const mockSchool = {
  id: 'school-123',
  name: 'Colegio Test',
  code: 'CT',
  slug: 'ct',
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
};

describe('useSchoolId', () => {
  it('returns the school id when a school is selected', () => {
    useSchoolStoreMock.mockImplementation((selector: (s: any) => any) =>
      selector({ currentSchool: mockSchool })
    );
    const { result } = renderHook(() => useSchoolId());
    expect(result.current).toBe('school-123');
  });

  it('returns empty string when no school is selected', () => {
    useSchoolStoreMock.mockImplementation((selector: (s: any) => any) =>
      selector({ currentSchool: null })
    );
    const { result } = renderHook(() => useSchoolId());
    expect(result.current).toBe('');
  });
});

describe('useSchoolIdOrNull', () => {
  it('returns the school id when a school is selected', () => {
    useSchoolStoreMock.mockImplementation((selector: (s: any) => any) =>
      selector({ currentSchool: mockSchool })
    );
    const { result } = renderHook(() => useSchoolIdOrNull());
    expect(result.current).toBe('school-123');
  });

  it('returns null when no school is selected', () => {
    useSchoolStoreMock.mockImplementation((selector: (s: any) => any) =>
      selector({ currentSchool: null })
    );
    const { result } = renderHook(() => useSchoolIdOrNull());
    expect(result.current).toBeNull();
  });
});
