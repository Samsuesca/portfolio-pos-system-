/**
 * Hook to get current school ID from store
 */
import { useSchoolStore } from '../stores/schoolStore';

/**
 * Returns the current school ID or throws if none selected
 */
export function useSchoolId(): string {
  const currentSchool = useSchoolStore((state) => state.currentSchool);

  if (!currentSchool) {
    // Return empty string - pages should handle this case
    return '';
  }

  return currentSchool.id;
}

/**
 * Returns the current school ID or null if none selected
 */
export function useSchoolIdOrNull(): string | null {
  const currentSchool = useSchoolStore((state) => state.currentSchool);
  return currentSchool?.id ?? null;
}
