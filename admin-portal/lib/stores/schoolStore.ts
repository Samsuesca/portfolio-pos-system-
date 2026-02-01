'use client';

/**
 * School Store - Zustand store for managing selected school
 *
 * Loads only schools the user has access to (not all schools in system)
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import schoolService from '@/lib/services/schoolService';
import { useAdminAuth } from '@/lib/adminAuth';
import type { School } from '@/lib/api';

interface SchoolState {
  // State
  currentSchool: School | null;
  availableSchools: School[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadSchools: () => Promise<void>;
  selectSchool: (school: School) => void;
  selectSchoolById: (schoolId: string) => Promise<void>;
  clearSchool: () => void;
}

export const useSchoolStore = create<SchoolState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentSchool: null,
      availableSchools: [],
      isLoading: false,
      error: null,

      // Load available schools (only user's schools, or all if superuser)
      loadSchools: async () => {
        set({ isLoading: true, error: null });

        try {
          const authState = useAdminAuth.getState();
          const user = authState.user;

          let schools: School[] = [];

          if (user?.is_superuser) {
            // Superusers can see all schools
            schools = await schoolService.list();
          } else if (user?.school_roles && user.school_roles.length > 0) {
            // Regular users only see their assigned schools
            const allSchools = await schoolService.list();
            const accessibleSchoolIds = user.school_roles.map((r) => r.school_id);
            schools = allSchools.filter(
              (s) => s.is_active && accessibleSchoolIds.includes(s.id)
            );
          }

          set({ availableSchools: schools, isLoading: false });

          // If no school selected but schools exist, select the first one
          const { currentSchool } = get();
          if (!currentSchool && schools.length > 0) {
            set({ currentSchool: schools[0] });
          }

          // If current school was deleted or user lost access, select first available
          if (currentSchool && !schools.find((s) => s.id === currentSchool.id)) {
            set({ currentSchool: schools.length > 0 ? schools[0] : null });
          }
        } catch (error: any) {
          set({
            error: error.response?.data?.detail || 'Error al cargar colegios',
            isLoading: false,
          });
        }
      },

      // Select a school
      selectSchool: (school: School) => {
        set({ currentSchool: school });
      },

      // Select school by ID
      selectSchoolById: async (schoolId: string) => {
        const { availableSchools } = get();

        // First check if already loaded
        const existing = availableSchools.find((s) => s.id === schoolId);
        if (existing) {
          set({ currentSchool: existing });
          return;
        }

        // Otherwise fetch it
        try {
          const school = await schoolService.getById(schoolId);
          set({ currentSchool: school });
        } catch (error: any) {
          set({
            error: error.response?.data?.detail || 'Error al cargar colegio',
          });
        }
      },

      // Clear selection
      clearSchool: () => {
        set({ currentSchool: null });
      },
    }),
    {
      name: 'admin-school-storage',
      partialize: (state) => ({
        currentSchool: state.currentSchool,
      }),
    }
  )
);

// Helper hook to get current school ID
export const useCurrentSchoolId = () => {
  const currentSchool = useSchoolStore((state) => state.currentSchool);
  return currentSchool?.id ?? null;
};
