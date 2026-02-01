'use client';

/**
 * ClientSelector - Searchable client selector with quick creation
 *
 * Features:
 * - Real-time search as you type
 * - Quick client creation inline
 * - Shows client info (name, phone, email, student)
 * - Email requirement option for orders
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search,
  UserPlus,
  X,
  Loader2,
  User,
  Phone,
  Mail,
  GraduationCap,
  Check,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';
import clientService from '@/lib/services/clientService';
import type { Client } from '@/lib/api';

interface ClientSelectorProps {
  value: string; // client_id or empty
  onChange: (clientId: string, client?: Client) => void;
  allowNoClient?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  error?: string;
  /** If true, email is required when creating a new client (for orders that need email verification) */
  requireEmail?: boolean;
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function ClientSelector({
  value,
  onChange,
  allowNoClient = false,
  placeholder = 'Buscar cliente...',
  className = '',
  disabled = false,
  error,
  requireEmail = false,
}: ClientSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Quick client creation
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [quickCreateLoading, setQuickCreateLoading] = useState(false);
  const [quickCreateError, setQuickCreateError] = useState<string | null>(null);
  const [quickClientData, setQuickClientData] = useState({
    name: '',
    phone: '',
    email: '',
    student_name: '',
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load clients when search changes or on mount
  useEffect(() => {
    loadClients();
  }, [debouncedSearch]);

  // Find selected client when value changes
  useEffect(() => {
    if (value) {
      if (selectedClient && selectedClient.id === value) {
        return;
      }
      const client = clients.find((c) => c.id === value);
      if (client) {
        setSelectedClient(client);
      }
    } else {
      setSelectedClient(null);
    }
  }, [value, clients]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowQuickCreate(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadClients = useCallback(async () => {
    try {
      setLoading(true);
      const data = await clientService.getClients({
        search: debouncedSearch || undefined,
        limit: 50,
      });
      setClients(data);
    } catch (err) {
      console.error('Error loading clients:', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  // Filter clients locally based on search
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const query = searchQuery.toLowerCase();
    return clients.filter(
      (c) =>
        c.name?.toLowerCase().includes(query) ||
        c.student_name?.toLowerCase().includes(query) ||
        c.phone?.includes(query) ||
        c.email?.toLowerCase().includes(query)
    );
  }, [clients, searchQuery]);

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    onChange(client.id, client);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = () => {
    setSelectedClient(null);
    onChange('');
    setSearchQuery('');
  };

  const handleQuickCreate = async () => {
    if (!quickClientData.name.trim()) {
      setQuickCreateError('El nombre es requerido');
      return;
    }

    if (requireEmail && !quickClientData.email.trim()) {
      setQuickCreateError('El email es requerido para recibir notificaciones del encargo');
      return;
    }

    // Validate email format if provided
    if (quickClientData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(quickClientData.email.trim())) {
        setQuickCreateError('El formato del email no es válido');
        return;
      }
    }

    // Validate phone if provided (Colombian format)
    if (quickClientData.phone.trim()) {
      const phone = quickClientData.phone.replace(/\D/g, '');
      if (phone.length !== 10 || !phone.startsWith('3')) {
        setQuickCreateError('El teléfono debe tener 10 dígitos y comenzar con 3');
        return;
      }
    }

    setQuickCreateLoading(true);
    setQuickCreateError(null);

    try {
      const newClient = await clientService.createClient({
        name: quickClientData.name.trim(),
        phone: quickClientData.phone.trim() || undefined,
        email: quickClientData.email.trim() || undefined,
        student_name: quickClientData.student_name.trim() || undefined,
      });

      // Add to clients list and select
      setClients([newClient, ...clients]);
      setSelectedClient(newClient);
      onChange(newClient.id, newClient);

      // Reset form
      setShowQuickCreate(false);
      setQuickClientData({ name: '', phone: '', email: '', student_name: '' });
      setIsOpen(false);
    } catch (err: any) {
      console.error('Error creating client:', err);
      setQuickCreateError(err.response?.data?.detail || 'Error al crear cliente');
    } finally {
      setQuickCreateLoading(false);
    }
  };

  const isValidPhone = (phone: string) => {
    if (!phone) return true;
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length === 10 && cleaned.startsWith('3');
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Selected value display / Search input */}
      <div className="relative">
        {!isOpen && selectedClient ? (
          // Show selected client
          <div
            onClick={() => !disabled && setIsOpen(true)}
            className={`
              w-full border rounded-lg px-3 py-2.5 flex items-center justify-between
              ${disabled ? 'bg-gray-100 cursor-default' : 'bg-white cursor-pointer hover:bg-gray-50'}
              ${error ? 'border-red-300' : 'border-slate-300'}
            `}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900 truncate">{selectedClient.name}</p>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  {selectedClient.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {selectedClient.phone}
                    </span>
                  )}
                  {selectedClient.email && (
                    <span className="flex items-center gap-1 truncate">
                      <Mail className="w-3 h-3" />
                      {selectedClient.email}
                    </span>
                  )}
                  {selectedClient.student_name && (
                    <span className="flex items-center gap-1 truncate">
                      <GraduationCap className="w-3 h-3" />
                      {selectedClient.student_name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {!disabled && (
              <div className="flex items-center gap-1 ml-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClear();
                  }}
                  className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 transition"
                  title="Quitar cliente"
                >
                  <X className="w-4 h-4" />
                </button>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </div>
            )}
          </div>
        ) : (
          // Search input
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsOpen(true)}
              placeholder={placeholder}
              disabled={disabled}
              className={`
                w-full pl-9 pr-3 py-2.5 border rounded-lg
                focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none
                ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
                ${error ? 'border-red-300' : 'border-slate-300'}
              `}
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
            )}
          </div>
        )}
      </div>

      {/* Error message */}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div
          className={`absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden ${
            showQuickCreate ? 'max-h-[420px]' : 'max-h-80'
          }`}
        >
          {/* Quick actions */}
          <div className="p-2 border-b border-slate-100 flex gap-2">
            <button
              type="button"
              onClick={() => setShowQuickCreate(true)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition font-medium"
            >
              <UserPlus className="w-4 h-4" />
              Crear cliente nuevo
            </button>
          </div>

          {/* Quick create form */}
          {showQuickCreate ? (
            <div className="p-3 border-b border-slate-100 bg-blue-50 max-h-[360px] overflow-y-auto">
              <h4 className="font-medium text-sm text-blue-800 mb-3 flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                Crear cliente rápido
              </h4>

              {quickCreateError && (
                <div className="mb-3 p-2 bg-red-100 text-red-700 text-sm rounded flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {quickCreateError}
                </div>
              )}

              <div className="space-y-2">
                <div className="relative">
                  <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={quickClientData.name}
                    onChange={(e) => setQuickClientData({ ...quickClientData, name: e.target.value })}
                    placeholder="Nombre del cliente *"
                    className="w-full pl-8 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    autoFocus
                  />
                </div>

                <div>
                  <div className="relative">
                    <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={quickClientData.phone}
                      onChange={(e) =>
                        setQuickClientData({
                          ...quickClientData,
                          phone: e.target.value.replace(/\D/g, '').slice(0, 10),
                        })
                      }
                      placeholder="3001234567 (opcional)"
                      className={`w-full pl-8 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        quickClientData.phone && !isValidPhone(quickClientData.phone) ? 'border-red-300' : ''
                      }`}
                    />
                  </div>
                  {quickClientData.phone && !isValidPhone(quickClientData.phone) && (
                    <p className="text-xs text-red-500 mt-0.5 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      10 dígitos, inicia con 3
                    </p>
                  )}
                </div>

                <div className="relative">
                  <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={quickClientData.email}
                    onChange={(e) => setQuickClientData({ ...quickClientData, email: e.target.value })}
                    placeholder={requireEmail ? 'Email del cliente *' : 'Email (opcional)'}
                    className={`w-full pl-8 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      requireEmail ? 'border-blue-300 bg-blue-50/50' : ''
                    }`}
                  />
                </div>
                {requireEmail && (
                  <p className="text-xs text-blue-600 -mt-1 ml-1">
                    El cliente recibirá notificaciones del encargo por email
                  </p>
                )}

                <div className="relative">
                  <GraduationCap className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={quickClientData.student_name}
                    onChange={(e) => setQuickClientData({ ...quickClientData, student_name: e.target.value })}
                    placeholder="Nombre estudiante (opcional)"
                    className="w-full pl-8 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowQuickCreate(false);
                    setQuickClientData({ name: '', phone: '', email: '', student_name: '' });
                    setQuickCreateError(null);
                  }}
                  className="px-3 py-1.5 text-sm text-slate-600 hover:bg-white rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleQuickCreate}
                  disabled={quickCreateLoading || !quickClientData.name.trim()}
                  className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {quickCreateLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Crear
                </button>
              </div>
            </div>
          ) : (
            /* Client list */
            <div className="max-h-56 overflow-y-auto">
              {filteredClients.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-sm">
                  {searchQuery ? (
                    <>
                      No se encontraron clientes con "{searchQuery}"
                      <button
                        type="button"
                        onClick={() => setShowQuickCreate(true)}
                        className="block mx-auto mt-2 text-blue-600 hover:underline"
                      >
                        Crear nuevo cliente
                      </button>
                    </>
                  ) : loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Cargando clientes...
                    </div>
                  ) : (
                    'No hay clientes registrados'
                  )}
                </div>
              ) : (
                filteredClients.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => handleSelectClient(client)}
                    className={`
                      w-full px-3 py-2.5 flex items-start gap-3 hover:bg-slate-50 transition text-left
                      ${client.id === value ? 'bg-blue-50' : ''}
                    `}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        client.id === value ? 'bg-blue-200' : 'bg-slate-100'
                      }`}
                    >
                      <User className={`w-4 h-4 ${client.id === value ? 'text-blue-700' : 'text-slate-500'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`font-medium truncate ${client.id === value ? 'text-blue-900' : 'text-slate-900'}`}>
                        {client.name}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                        {client.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {client.phone}
                          </span>
                        )}
                        {client.email && (
                          <span className="flex items-center gap-1 truncate">
                            <Mail className="w-3 h-3" />
                            {client.email}
                          </span>
                        )}
                        {client.student_name && (
                          <span className="flex items-center gap-1 truncate">
                            <GraduationCap className="w-3 h-3" />
                            {client.student_name}
                          </span>
                        )}
                        {!client.email && (
                          <span className="text-orange-500 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Sin email
                          </span>
                        )}
                      </div>
                    </div>
                    {client.id === value && <Check className="w-4 h-4 text-blue-600 flex-shrink-0 mt-2" />}
                  </button>
                ))
              )}
            </div>
          )}

          {/* Results count */}
          {!showQuickCreate && filteredClients.length > 0 && (
            <div className="px-3 py-2 border-t border-slate-100 text-xs text-slate-500 text-center">
              {`${filteredClients.length} cliente${filteredClients.length !== 1 ? 's' : ''}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
