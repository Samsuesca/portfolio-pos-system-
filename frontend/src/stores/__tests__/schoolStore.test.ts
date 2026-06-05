import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSchoolStore } from '../schoolStore';
import { schoolService } from '../../services/schoolService';
import { userService } from '../../services/userService';
import { useAuthStore } from '../authStore';
import type { School } from '../../services/schoolService';

vi.mock('../../services/schoolService', () => ({
  schoolService: {
    getSchools: vi.fn(),
    getSchool: vi.fn(),
  },
}));

vi.mock('../../services/userService', () => ({
  userService: {
    getUserSchools: vi.fn(),
  },
}));

vi.mock('../authStore', () => ({
  useAuthStore: {
    getState: vi.fn(),
  },
}));

const mockSchool: School = {
  id: 'school-1',
  code: 'COL1',
  name: 'Colegio Test',
  slug: 'col1',
  email: null,
  phone: null,
  address: null,
  logo_url: null,
  primary_color: null,
  secondary_color: null,
  settings: null,
  is_active: true,
  created_at: '2026-01-01T00:00:00',
  updated_at: null,
};

const mockSchool2: School = {
  ...mockSchool,
  id: 'school-2',
  code: 'COL2',
  name: 'Colegio Dos',
  slug: 'col2',
};

function paginatedOf<T>(items: T[]) {
  return { items, total: items.length, skip: 0, limit: 100, page: 1, total_pages: 1, has_more: false };
}

describe('schoolStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSchoolStore.setState({
      currentSchool: null,
      availableSchools: [],
      isLoading: false,
      error: null,
    });
  });

  describe('loadSchools — superuser', () => {
    it('loads all schools for superusers', async () => {
      vi.mocked(useAuthStore.getState).mockReturnValue({
        user: { id: 'user-1', is_superuser: true },
      } as any);
      vi.mocked(schoolService.getSchools).mockResolvedValueOnce(paginatedOf([mockSchool, mockSchool2]) as any);

      await useSchoolStore.getState().loadSchools();

      const state = useSchoolStore.getState();
      expect(state.availableSchools).toHaveLength(2);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('auto-selects first school when none is selected', async () => {
      vi.mocked(useAuthStore.getState).mockReturnValue({
        user: { id: 'user-1', is_superuser: true },
      } as any);
      vi.mocked(schoolService.getSchools).mockResolvedValueOnce(paginatedOf([mockSchool]) as any);

      await useSchoolStore.getState().loadSchools();

      expect(useSchoolStore.getState().currentSchool?.id).toBe('school-1');
    });

    it('keeps current selection if school still exists', async () => {
      useSchoolStore.setState({ currentSchool: mockSchool2 });
      vi.mocked(useAuthStore.getState).mockReturnValue({
        user: { id: 'user-1', is_superuser: true },
      } as any);
      vi.mocked(schoolService.getSchools).mockResolvedValueOnce(paginatedOf([mockSchool, mockSchool2]) as any);

      await useSchoolStore.getState().loadSchools();

      expect(useSchoolStore.getState().currentSchool?.id).toBe('school-2');
    });

    it('replaces current selection when school no longer accessible', async () => {
      const orphanSchool = { ...mockSchool, id: 'school-orphan' };
      useSchoolStore.setState({ currentSchool: orphanSchool });
      vi.mocked(useAuthStore.getState).mockReturnValue({
        user: { id: 'user-1', is_superuser: true },
      } as any);
      vi.mocked(schoolService.getSchools).mockResolvedValueOnce(paginatedOf([mockSchool]) as any);

      await useSchoolStore.getState().loadSchools();

      expect(useSchoolStore.getState().currentSchool?.id).toBe('school-1');
    });
  });

  describe('loadSchools — regular user', () => {
    it('loads only user-assigned active schools', async () => {
      vi.mocked(useAuthStore.getState).mockReturnValue({
        user: { id: 'user-2', is_superuser: false },
      } as any);
      vi.mocked(userService.getUserSchools).mockResolvedValueOnce([
        {
          school: { ...mockSchool, is_active: true },
          created_at: '2026-01-01T00:00:00',
        },
        {
          school: { ...mockSchool2, is_active: false },
          created_at: '2026-01-01T00:00:00',
        },
      ] as any);

      await useSchoolStore.getState().loadSchools();

      const state = useSchoolStore.getState();
      expect(state.availableSchools).toHaveLength(1);
      expect(state.availableSchools[0].id).toBe('school-1');
    });

    it('sets empty schools when user has no access', async () => {
      vi.mocked(useAuthStore.getState).mockReturnValue({
        user: { id: 'user-2', is_superuser: false },
      } as any);
      vi.mocked(userService.getUserSchools).mockResolvedValueOnce([]);

      await useSchoolStore.getState().loadSchools();

      expect(useSchoolStore.getState().availableSchools).toHaveLength(0);
      expect(useSchoolStore.getState().currentSchool).toBeNull();
    });
  });

  describe('loadSchools — no user', () => {
    it('sets empty schools when user is null', async () => {
      vi.mocked(useAuthStore.getState).mockReturnValue({ user: null } as any);

      await useSchoolStore.getState().loadSchools();

      expect(useSchoolStore.getState().availableSchools).toHaveLength(0);
    });
  });

  describe('loadSchools — error handling', () => {
    it('sets error message on failure', async () => {
      vi.mocked(useAuthStore.getState).mockReturnValue({
        user: { id: 'user-1', is_superuser: true },
      } as any);
      vi.mocked(schoolService.getSchools).mockRejectedValueOnce({
        response: { data: { detail: 'Forbidden' } },
      });

      await useSchoolStore.getState().loadSchools();

      const state = useSchoolStore.getState();
      expect(state.error).toBe('Forbidden');
      expect(state.isLoading).toBe(false);
    });

    it('uses fallback error message when no response detail', async () => {
      vi.mocked(useAuthStore.getState).mockReturnValue({
        user: { id: 'user-1', is_superuser: true },
      } as any);
      vi.mocked(schoolService.getSchools).mockRejectedValueOnce(new Error('Network Error'));

      await useSchoolStore.getState().loadSchools();

      expect(useSchoolStore.getState().error).toBe('Error al cargar colegios');
    });
  });

  describe('selectSchool', () => {
    it('sets currentSchool', () => {
      useSchoolStore.getState().selectSchool(mockSchool);

      expect(useSchoolStore.getState().currentSchool?.id).toBe('school-1');
    });
  });

  describe('selectSchoolById', () => {
    it('selects from available schools without API call', async () => {
      useSchoolStore.setState({ availableSchools: [mockSchool, mockSchool2] });

      await useSchoolStore.getState().selectSchoolById('school-2');

      expect(useSchoolStore.getState().currentSchool?.id).toBe('school-2');
      expect(schoolService.getSchool).not.toHaveBeenCalled();
    });

    it('fetches school by ID when not in available list', async () => {
      useSchoolStore.setState({ availableSchools: [] });
      vi.mocked(schoolService.getSchool).mockResolvedValueOnce(mockSchool as any);

      await useSchoolStore.getState().selectSchoolById('school-1');

      expect(schoolService.getSchool).toHaveBeenCalledWith('school-1');
      expect(useSchoolStore.getState().currentSchool?.id).toBe('school-1');
    });

    it('sets error when fetch fails', async () => {
      useSchoolStore.setState({ availableSchools: [] });
      vi.mocked(schoolService.getSchool).mockRejectedValueOnce({
        response: { data: { detail: 'Not found' } },
      });

      await useSchoolStore.getState().selectSchoolById('nonexistent');

      expect(useSchoolStore.getState().error).toBe('Not found');
    });
  });

  describe('clearSchool', () => {
    it('sets currentSchool to null', () => {
      useSchoolStore.setState({ currentSchool: mockSchool });

      useSchoolStore.getState().clearSchool();

      expect(useSchoolStore.getState().currentSchool).toBeNull();
    });
  });
});
