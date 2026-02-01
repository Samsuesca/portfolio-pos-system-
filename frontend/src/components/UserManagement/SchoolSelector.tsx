/**
 * SchoolSelector - Dropdown for selecting active school
 */
import { Building2, Users } from 'lucide-react';
import type { School } from './types';

interface SchoolSelectorProps {
  schools: School[];
  selectedSchoolId: string;
  onSelect: (schoolId: string) => void;
  loading?: boolean;
  className?: string;
  showAllUsersOption?: boolean;
}

export default function SchoolSelector({
  schools,
  selectedSchoolId,
  onSelect,
  loading = false,
  className = '',
  showAllUsersOption = false,
}: SchoolSelectorProps) {
  const isAllUsers = selectedSchoolId === '__all__';

  return (
    <div className={`relative min-w-[250px] ${className}`}>
      {isAllUsers ? (
        <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-purple-500" />
      ) : (
        <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
      )}
      <select
        value={selectedSchoolId}
        onChange={(e) => onSelect(e.target.value)}
        disabled={loading}
        className={`w-full pl-9 pr-8 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none bg-white text-sm ${
          isAllUsers ? 'border-purple-300 text-purple-700 font-medium' : 'border-gray-300'
        }`}
      >
        <option value="">Selecciona un colegio</option>
        {showAllUsersOption && (
          <option value="__all__" className="font-medium text-purple-700">
            Todos los Usuarios del Sistema
          </option>
        )}
        {schools.map((school) => (
          <option key={school.id} value={school.id}>
            {school.name}
          </option>
        ))}
      </select>
    </div>
  );
}
