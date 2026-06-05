import { create } from 'zustand';
import apiClient, { extractErrorMessage } from '../utils/apiClient';
import { useAuthStore } from './authStore';
import type { School, UserSchoolRole } from '../types/api';

interface SchoolState {
  currentSchool: School | null;
  availableSchools: School[];
  isLoading: boolean;
  error: string | null;

  loadSchools: () => Promise<void>;
  selectSchool: (school: School) => void;
  clearSchool: () => void;
}

export const useSchoolStore = create<SchoolState>()((set, get) => ({
  currentSchool: null,
  availableSchools: [],
  isLoading: false,
  error: null,

  loadSchools: async () => {
    set({ isLoading: true, error: null });
    try {
      const user = useAuthStore.getState().user;
      let schools: School[] = [];

      if (user?.is_superuser) {
        const response = await apiClient.get<School[]>('/schools', {
          params: { active_only: true },
        });
        schools = response.data;
      } else if (user?.school_roles?.length) {
        const response = await apiClient.get<School[]>('/schools', {
          params: { active_only: true },
        });
        const roleSchoolIds = new Set(
          user.school_roles.map((r: UserSchoolRole) => r.school_id)
        );
        schools = response.data.filter((s: School) => roleSchoolIds.has(s.id));
      }

      set({ availableSchools: schools, isLoading: false });

      const { currentSchool } = get();
      if (!currentSchool && schools.length > 0) {
        set({ currentSchool: schools[0] });
      }
      if (currentSchool && !schools.find((s) => s.id === currentSchool.id)) {
        set({ currentSchool: schools.length > 0 ? schools[0] : null });
      }
    } catch (error) {
      set({ error: extractErrorMessage(error), isLoading: false });
    }
  },

  selectSchool: (school: School) => set({ currentSchool: school }),

  clearSchool: () => set({ currentSchool: null }),
}));

export const useCurrentSchoolId = (): string | null => {
  return useSchoolStore((state) => state.currentSchool?.id ?? null);
};
