/**
 * Branch Store - Zustand store for the selected branch (sucursal física, v3.1)
 *
 * Diferencias clave frente a schoolStore:
 *  - `currentBranch: null` significa CONSOLIDADO (todas las sucursales). NO se
 *    auto-selecciona la primera: el default es "todas" (backward-compat — el
 *    sistema arranca como hoy, sin filtro de sucursal).
 *  - `branch_id` es un filtro OPCIONAL en los services; nunca rompe las llamadas
 *    actuales (si es null, no se envía el param).
 *  - El endpoint /branches puede no existir todavía: loadBranches() degrada a
 *    `availableBranches = []` (el selector queda oculto, UI idéntica a la actual).
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { branchService, type Branch } from '../services/branchService';
import { userService } from '../services/userService';
import { useAuthStore } from './authStore';

interface BranchState {
  // State
  currentBranch: Branch | null;   // null = consolidado (todas las sucursales)
  availableBranches: Branch[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadBranches: () => Promise<void>;
  selectBranch: (branch: Branch) => void;
  selectBranchById: (branchId: string) => Promise<void>;
  clearBranch: () => void;        // volver a consolidado
}

export const useBranchStore = create<BranchState>()(
  persist(
    (set, get) => ({
      // Initial state — arranca en consolidado (sin sucursal seleccionada).
      currentBranch: null,
      availableBranches: [],
      isLoading: false,
      error: null,

      loadBranches: async () => {
        set({ isLoading: true, error: null });

        try {
          const authState = useAuthStore.getState();
          const user = authState.user;

          let branches: Branch[] = [];

          if (user?.is_superuser) {
            // Superuser: ve todas las sucursales.
            branches = await branchService.getBranches();
          } else if (user?.id) {
            // Usuario regular: deriva de sus roles con branch_id no-null.
            // Si TODOS sus roles son centrales (branch_id null/ausente), no hay
            // sucursales que mostrar ⇒ selector oculto.
            const roles = await userService.getUserSchools(user.id);
            const restrictedBranchIds = [
              ...new Set(
                roles.map((r) => r.branch_id).filter((b): b is string => !!b)
              ),
            ];
            if (restrictedBranchIds.length > 0) {
              const all = await branchService.getBranches();
              branches = all.filter((b) => restrictedBranchIds.includes(b.id));
            }
          }

          // Si la sucursal actual ya no está disponible, volver a consolidado.
          const { currentBranch } = get();
          const stillAvailable =
            currentBranch && branches.some((b) => b.id === currentBranch.id);

          set({
            availableBranches: branches,
            currentBranch: stillAvailable ? currentBranch : null,
            isLoading: false,
          });
        } catch {
          // Degradación graceful: el endpoint /branches puede no existir aún.
          // Sin sucursales ⇒ selector oculto, comportamiento idéntico a hoy.
          set({ availableBranches: [], isLoading: false });
        }
      },

      selectBranch: (branch: Branch) => {
        set({ currentBranch: branch });
      },

      selectBranchById: async (branchId: string) => {
        const { availableBranches } = get();
        const existing = availableBranches.find((b) => b.id === branchId);
        if (existing) {
          set({ currentBranch: existing });
          return;
        }
        try {
          const branch = await branchService.getBranch(branchId);
          set({ currentBranch: branch });
        } catch (error: any) {
          set({
            error: error.response?.data?.detail || 'Error al cargar sucursal',
          });
        }
      },

      // Volver a consolidado (todas las sucursales).
      clearBranch: () => {
        set({ currentBranch: null });
      },
    }),
    {
      name: 'branch-storage',
      partialize: (state) => ({
        currentBranch: state.currentBranch,
      }),
    }
  )
);

// Helper hook: id de la sucursal seleccionada, o null si consolidado.
export const useCurrentBranchId = () => {
  const currentBranch = useBranchStore((state) => state.currentBranch);
  return currentBranch?.id ?? null;
};
