import { useState, useRef, useEffect, useCallback } from 'react';
import { User, Search, Plus, X, Building2, Loader2 } from 'lucide-react';
import { useVendors } from '../../hooks/useVendors';
import type { VendorSearchResult } from '../../services/vendorService';

interface VendorComboboxProps {
  value: string | null;
  onChange: (vendorId: string | null) => void;
  required?: boolean;
  placeholder?: string;
  label?: string;
  className?: string;
}

export default function VendorCombobox({
  value,
  onChange,
  required = false,
  placeholder = 'Buscar proveedor...',
  label = 'Proveedor',
  className = '',
}: VendorComboboxProps) {
  const { activeVendors, searchVendors, createVendor, getVendorName, loading: initialLoading } = useVendors();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VendorSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const selectedName = value ? getVendorName(value) : null;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults(activeVendors.map(v => ({ id: v.id, name: v.name, type: v.type })).slice(0, 15));
      return;
    }
    setSearching(true);
    try {
      const r = await searchVendors(q);
      setResults(r);
    } finally {
      setSearching(false);
    }
  }, [activeVendors, searchVendors]);

  const handleInputChange = (val: string) => {
    setQuery(val);
    setIsOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const handleSelect = (vendorId: string) => {
    onChange(vendorId);
    setQuery('');
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setQuery('');
    setResults([]);
  };

  const handleCreate = async () => {
    if (!query.trim()) return;
    setCreating(true);
    try {
      const vendor = await createVendor({ name: query.trim() });
      onChange(vendor.id);
      setQuery('');
      setIsOpen(false);
    } catch {
      // error handled by hook
    } finally {
      setCreating(false);
    }
  };

  const handleFocus = () => {
    setIsOpen(true);
    if (!query) {
      setResults(activeVendors.map(v => ({ id: v.id, name: v.name, type: v.type })).slice(0, 15));
    }
  };

  const showCreateOption = query.trim().length >= 2 && !results.some(r => r.name.toLowerCase() === query.trim().toLowerCase());

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="flex items-center gap-2 text-sm font-medium text-stone-700 mb-2">
          <User className="w-4 h-4 text-stone-400" />
          {label}{required && ' *'}
        </label>
      )}

      {value && selectedName ? (
        <div className="flex items-center gap-2 px-4 py-2.5 border border-stone-200 rounded-lg bg-stone-50">
          <span className="flex-1 text-stone-800">{selectedName}</span>
          <button
            type="button"
            onClick={handleClear}
            className="p-0.5 text-stone-400 hover:text-stone-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={handleFocus}
            placeholder={initialLoading ? 'Cargando...' : placeholder}
            disabled={initialLoading}
            className="w-full pl-10 pr-4 py-2.5 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30 focus:border-brand-500"
          />
        </div>
      )}

      {isOpen && !value && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-stone-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {searching && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-stone-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Buscando...
            </div>
          )}

          {!searching && results.length === 0 && query.trim().length < 2 && (
            <div className="px-4 py-3 text-sm text-stone-400">
              Escribe al menos 2 caracteres...
            </div>
          )}

          {!searching && results.length === 0 && query.trim().length >= 2 && !showCreateOption && (
            <div className="px-4 py-3 text-sm text-stone-400">
              Sin resultados
            </div>
          )}

          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => handleSelect(r.id)}
              className="w-full text-left px-4 py-2.5 hover:bg-stone-50 flex items-center gap-2 transition-colors"
            >
              {r.type === 'business' ? (
                <Building2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
              ) : (
                <User className="w-4 h-4 text-stone-400 flex-shrink-0" />
              )}
              <span className="text-sm text-stone-700">{r.name}</span>
              <span className="text-xs text-stone-400 ml-auto">{r.type === 'business' ? 'Empresa' : r.type === 'internal' ? 'Sistema' : 'Persona'}</span>
            </button>
          ))}

          {showCreateOption && (
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 flex items-center gap-2 border-t border-stone-100 text-emerald-700 transition-colors"
            >
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span className="text-sm">Crear &quot;{query.trim()}&quot;</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
