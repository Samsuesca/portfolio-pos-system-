import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import type { School } from '../services/schoolService';

interface SearchableSchoolSelectProps {
  schools: School[];
  value: string;
  onChange: (schoolId: string) => void;
}

export default function SearchableSchoolSelect({ schools, value, onChange }: SearchableSchoolSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedSchool = schools.find(s => s.id === value);

  const filtered = query.trim()
    ? schools.filter(s => s.name.toLowerCase().includes(query.toLowerCase()))
    : schools;

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-brand-300 rounded-lg bg-brand-50 text-left flex items-center justify-between focus:ring-2 focus:ring-brand-400/30 focus:border-transparent outline-none"
      >
        <span className="truncate text-stone-800">
          {selectedSchool?.name || 'Seleccionar colegio'}
        </span>
        <ChevronDown className={`w-4 h-4 text-stone-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-stone-200 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-stone-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar colegio..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-stone-200 rounded focus:ring-1 focus:ring-brand-400/30 outline-none"
              />
            </div>
          </div>
          <ul className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-stone-500">Sin resultados</li>
            ) : (
              filtered.map(school => (
                <li key={school.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(school.id);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-brand-50 transition ${
                      school.id === value ? 'bg-brand-50 text-brand-700 font-medium' : 'text-stone-700'
                    }`}
                  >
                    <span className="truncate">{school.name}</span>
                    {school.id === value && <Check className="w-4 h-4 text-brand-600 flex-shrink-0" />}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
