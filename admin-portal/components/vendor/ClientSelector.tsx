'use client';

/**
 * ClientSelector - Searchable client selector with quick creation
 *
 * Features:
 * - Real-time search as you type
 * - Fuzzy search with typo tolerance
 * - Quick client creation inline
 * - Option for "No client" sales
 * - Shows client info (name, phone, student)
 */
import { useState, useEffect, useRef } from 'react';
import {
  Search,
  UserPlus,
  UserX,
  X,
  Loader2,
  User,
  Phone,
  Mail,
  GraduationCap,
  Check,
  Pencil,
  MapPin,
  Save,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react';
import clientService from '@/lib/services/clientService';
import type { Client } from '@/lib/api';

// =============================================================================
// Phone Validation Utility
// =============================================================================

/**
 * Validate Colombian phone number format.
 * Returns true if valid (10 digits starting with 3).
 */
function isValidColombianPhone(phone: string): boolean {
  const clean = phone.replace(/\D/g, '');
  return /^3\d{9}$/.test(clean);
}

// =============================================================================
// Fuzzy Search Utilities
// =============================================================================

/**
 * Normalize text for comparison:
 * - Remove accents
 * - Lowercase
 * - Handle common letter substitutions
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/v/g, 'b')
    .replace(/z/g, 's')
    .replace(/c(?=[ei])/g, 's')
    .replace(/qu/g, 'k')
    .replace(/ll/g, 'y')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate similarity score between query and text (0-1)
 */
function calculateSimilarity(query: string, text: string): number {
  const normalizedQuery = normalizeText(query);
  const normalizedText = normalizeText(text);

  if (normalizedText.includes(normalizedQuery)) {
    return 1;
  }

  const words = normalizedText.split(/\s+/);
  for (const word of words) {
    if (word.startsWith(normalizedQuery)) {
      return 0.95;
    }
  }

  let bestScore = 0;
  for (const word of words) {
    if (Math.abs(word.length - normalizedQuery.length) <= Math.max(3, normalizedQuery.length * 0.5)) {
      const distance = levenshteinDistance(normalizedQuery, word);
      const maxLen = Math.max(normalizedQuery.length, word.length);
      const similarity = 1 - distance / maxLen;

      if (similarity > 0.6) {
        bestScore = Math.max(bestScore, similarity * 0.9);
      }
    }
  }

  return bestScore;
}

interface ClientWithScore extends Client {
  _searchScore: number;
}

// Special value for "No Client" option
export const NO_CLIENT_ID = '__NO_CLIENT__';

interface ClientSelectorProps {
  value: string; // client_id or NO_CLIENT_ID or empty
  onChange: (clientId: string, client?: Client) => void;
  schoolId: string;
  allowNoClient?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  error?: string;
  requireEmail?: boolean;
}

export default function ClientSelector({
  value,
  onChange,
  schoolId,
  allowNoClient = true,
  placeholder = 'Buscar cliente...',
  className = '',
  disabled = false,
  error,
  requireEmail = false,
}: ClientSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
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

  // Edit client state
  const [showEditForm, setShowEditForm] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editClientData, setEditClientData] = useState({
    name: '',
    phone: '',
    email: '',
    student_name: '',
    student_grade: '',
    address: '',
    notes: '',
  });

  // Expanded info view
  const [showExpandedInfo, setShowExpandedInfo] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load all clients on mount
  useEffect(() => {
    if (schoolId) {
      loadClients();
    }
  }, [schoolId]);

  // Find selected client when value changes
  useEffect(() => {
    if (value && value !== NO_CLIENT_ID) {
      const client = clients.find((c) => c.id === value);
      setSelectedClient(client || null);
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

  // Filter clients when search query changes (with fuzzy matching)
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      if (searchQuery.trim()) {
        const query = searchQuery.trim();

        const scored: ClientWithScore[] = clients.map((client) => {
          if (client.phone?.includes(query)) {
            return { ...client, _searchScore: 1 };
          }

          const nameScore = calculateSimilarity(query, client.name);
          const studentScore = client.student_name
            ? calculateSimilarity(query, client.student_name)
            : 0;

          return {
            ...client,
            _searchScore: Math.max(nameScore, studentScore),
          };
        });

        const filtered = scored
          .filter((c) => c._searchScore >= 0.5)
          .sort((a, b) => b._searchScore - a._searchScore)
          .slice(0, 50);

        setFilteredClients(filtered);
      } else {
        setFilteredClients(clients.slice(0, 50));
      }
    }, 150);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, clients]);

  const loadClients = async () => {
    try {
      setLoading(true);
      // Clients are global in this system, no schoolId needed
      const data = await clientService.getClients({ limit: 500 });
      setClients(data);
      setFilteredClients(data.slice(0, 50));
    } catch (err) {
      console.error('Error loading clients:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    onChange(client.id, client);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleSelectNoClient = () => {
    setSelectedClient(null);
    onChange(NO_CLIENT_ID);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = () => {
    setSelectedClient(null);
    onChange('');
    setSearchQuery('');
    setShowExpandedInfo(false);
    setShowEditForm(false);
  };

  const handleStartEdit = () => {
    if (selectedClient) {
      setEditClientData({
        name: selectedClient.name || '',
        phone: selectedClient.phone || '',
        email: selectedClient.email || '',
        student_name: selectedClient.student_name || '',
        student_grade: selectedClient.student_grade || '',
        address: selectedClient.address || '',
        notes: selectedClient.notes || '',
      });
      setShowEditForm(true);
      setEditError(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedClient || !editClientData.name.trim()) {
      setEditError('El nombre es requerido');
      return;
    }

    if (editClientData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(editClientData.email.trim())) {
        setEditError('El formato del email no es valido');
        return;
      }
    }

    setEditLoading(true);
    setEditError(null);

    try {
      const updatedClient = await clientService.updateClient(selectedClient.id, {
        name: editClientData.name.trim(),
        phone: editClientData.phone.trim() || undefined,
        email: editClientData.email.trim() || undefined,
        student_name: editClientData.student_name.trim() || undefined,
        student_grade: editClientData.student_grade.trim() || undefined,
        address: editClientData.address.trim() || undefined,
        notes: editClientData.notes.trim() || undefined,
      });

      setSelectedClient(updatedClient);
      setClients(clients.map((c) => (c.id === updatedClient.id ? updatedClient : c)));
      onChange(updatedClient.id, updatedClient);

      setShowEditForm(false);
    } catch (err: any) {
      console.error('Error updating client:', err);
      setEditError(err.response?.data?.detail || err.message || 'Error al actualizar cliente');
    } finally {
      setEditLoading(false);
    }
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

    if (quickClientData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(quickClientData.email.trim())) {
        setQuickCreateError('El formato del email no es valido');
        return;
      }
    }

    setQuickCreateLoading(true);
    setQuickCreateError(null);

    try {
      // Clients are global, no schoolId needed
      const newClient = await clientService.createClient({
        name: quickClientData.name.trim(),
        phone: quickClientData.phone.trim() || undefined,
        email: quickClientData.email.trim() || undefined,
        student_name: quickClientData.student_name.trim() || undefined,
      });

      setClients([newClient, ...clients]);
      setSelectedClient(newClient);
      onChange(newClient.id, newClient);

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

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Selected value display / Search input */}
      <div className="relative">
        {!isOpen && (value || selectedClient) ? (
          // Show selected client - expandable card
          <div
            className={`
              w-full border rounded-lg overflow-hidden
              ${disabled ? 'bg-gray-100' : 'bg-white'}
              ${error ? 'border-red-300' : 'border-gray-300'}
            `}
          >
            {/* Main row - clickable to open search */}
            <div
              onClick={() => !disabled && !showEditForm && setIsOpen(true)}
              className={`
                px-3 py-2 flex items-center justify-between
                ${disabled || showEditForm ? 'cursor-default' : 'cursor-pointer hover:bg-gray-50'}
              `}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {value === NO_CLIENT_ID ? (
                  <>
                    <UserX className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-500">Sin cliente</span>
                  </>
                ) : selectedClient ? (
                  <>
                    <User className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 truncate">
                          {selectedClient.name}
                        </span>
                        {selectedClient.code && (
                          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                            #{selectedClient.code}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
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
                      </div>
                    </div>
                  </>
                ) : null}
              </div>

              {/* Action buttons */}
              {!disabled && selectedClient && value !== NO_CLIENT_ID && (
                <div className="flex items-center gap-1 ml-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowExpandedInfo(!showExpandedInfo);
                      setShowEditForm(false);
                    }}
                    className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                    title={showExpandedInfo ? 'Ocultar detalles' : 'Ver detalles'}
                  >
                    {showExpandedInfo ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEdit();
                      setShowExpandedInfo(true);
                    }}
                    className="p-1.5 hover:bg-blue-50 rounded text-gray-400 hover:text-blue-600"
                    title="Editar cliente"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClear();
                    }}
                    className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"
                    title="Quitar cliente"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {!disabled && value === NO_CLIENT_ID && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClear();
                  }}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>

            {/* Expanded info section */}
            {showExpandedInfo && selectedClient && !showEditForm && (
              <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 text-sm">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {selectedClient.student_name && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <GraduationCap className="w-4 h-4 text-gray-400" />
                      <span>{selectedClient.student_name}</span>
                      {selectedClient.student_grade && (
                        <span className="text-gray-400">({selectedClient.student_grade})</span>
                      )}
                    </div>
                  )}
                  {selectedClient.address && (
                    <div className="flex items-center gap-2 text-gray-600 col-span-2">
                      <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{selectedClient.address}</span>
                    </div>
                  )}
                  {selectedClient.notes && (
                    <div className="col-span-2 text-gray-500 italic text-xs mt-1 border-t border-gray-200 pt-2">
                      {selectedClient.notes}
                    </div>
                  )}
                  {!selectedClient.student_name &&
                    !selectedClient.address &&
                    !selectedClient.notes && (
                      <div className="col-span-2 text-gray-400 text-xs">
                        No hay informacion adicional
                      </div>
                    )}
                </div>
              </div>
            )}

            {/* Edit form */}
            {showEditForm && selectedClient && (
              <div className="px-3 py-3 bg-blue-50 border-t border-blue-200">
                <h4 className="font-medium text-sm text-blue-800 mb-3 flex items-center gap-2">
                  <Pencil className="w-4 h-4" />
                  Editar cliente
                </h4>

                {editError && (
                  <div className="mb-3 p-2 bg-red-100 text-red-700 text-sm rounded">
                    {editError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="relative col-span-2">
                    <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={editClientData.name}
                      onChange={(e) =>
                        setEditClientData({ ...editClientData, name: e.target.value })
                      }
                      placeholder="Nombre *"
                      className="w-full pl-8 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <div className="relative">
                      <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        value={editClientData.phone}
                        onChange={(e) =>
                          setEditClientData({
                            ...editClientData,
                            phone: e.target.value.replace(/\D/g, '').slice(0, 10),
                          })
                        }
                        placeholder="3001234567"
                        className={`w-full pl-8 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          editClientData.phone && !isValidColombianPhone(editClientData.phone)
                            ? 'border-red-300'
                            : ''
                        }`}
                      />
                    </div>
                    {editClientData.phone && !isValidColombianPhone(editClientData.phone) && (
                      <p className="text-xs text-red-500 mt-0.5 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        10 digitos, inicia con 3
                      </p>
                    )}
                  </div>

                  <div className="relative">
                    <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      value={editClientData.email}
                      onChange={(e) =>
                        setEditClientData({ ...editClientData, email: e.target.value })
                      }
                      placeholder="Email"
                      className="w-full pl-8 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="relative">
                    <GraduationCap className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={editClientData.student_name}
                      onChange={(e) =>
                        setEditClientData({ ...editClientData, student_name: e.target.value })
                      }
                      placeholder="Nombre estudiante"
                      className="w-full pl-8 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      value={editClientData.student_grade}
                      onChange={(e) =>
                        setEditClientData({ ...editClientData, student_grade: e.target.value })
                      }
                      placeholder="Grado (ej: 5A)"
                      className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="relative col-span-2">
                    <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={editClientData.address}
                      onChange={(e) =>
                        setEditClientData({ ...editClientData, address: e.target.value })
                      }
                      placeholder="Direccion"
                      className="w-full pl-8 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="col-span-2">
                    <textarea
                      value={editClientData.notes}
                      onChange={(e) =>
                        setEditClientData({ ...editClientData, notes: e.target.value })
                      }
                      placeholder="Notas adicionales..."
                      rows={2}
                      className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    />
                  </div>
                </div>

                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEditForm(false)}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:bg-white rounded-lg transition"
                    disabled={editLoading}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={editLoading || !editClientData.name.trim()}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    {editLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Guardar
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          // Search input
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsOpen(true)}
              placeholder={placeholder}
              disabled={disabled}
              className={`
                w-full pl-9 pr-3 py-2 border rounded-lg
                focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none
                ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
                ${error ? 'border-red-300' : 'border-gray-300'}
              `}
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
            )}
          </div>
        )}
      </div>

      {/* Error message */}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-hidden">
          {/* Quick actions */}
          <div className="p-2 border-b border-gray-100 flex gap-2">
            {allowNoClient && (
              <button
                type="button"
                onClick={handleSelectNoClient}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                <UserX className="w-4 h-4" />
                Sin cliente
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowQuickCreate(true)}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition"
            >
              <UserPlus className="w-4 h-4" />
              Nuevo cliente
            </button>
          </div>

          {/* Quick create form */}
          {showQuickCreate ? (
            <div className="p-3 border-b border-gray-100 bg-blue-50">
              <h4 className="font-medium text-sm text-blue-800 mb-3 flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                Crear cliente rapido
              </h4>

              {quickCreateError && (
                <div className="mb-3 p-2 bg-red-100 text-red-700 text-sm rounded">
                  {quickCreateError}
                </div>
              )}

              <div className="space-y-2">
                <div className="relative">
                  <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={quickClientData.name}
                    onChange={(e) =>
                      setQuickClientData({ ...quickClientData, name: e.target.value })
                    }
                    placeholder="Nombre del cliente *"
                    className="w-full pl-8 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    autoFocus
                  />
                </div>

                <div>
                  <div className="relative">
                    <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
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
                        quickClientData.phone && !isValidColombianPhone(quickClientData.phone)
                          ? 'border-red-300'
                          : ''
                      }`}
                    />
                  </div>
                  {quickClientData.phone && !isValidColombianPhone(quickClientData.phone) && (
                    <p className="text-xs text-red-500 mt-0.5 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      10 digitos, inicia con 3
                    </p>
                  )}
                </div>

                <div className="relative">
                  <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={quickClientData.email}
                    onChange={(e) =>
                      setQuickClientData({ ...quickClientData, email: e.target.value })
                    }
                    placeholder={
                      requireEmail ? 'Email del cliente *' : 'Email (opcional - para portal web)'
                    }
                    className={`w-full pl-8 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      requireEmail ? 'border-blue-300 bg-blue-50' : ''
                    }`}
                  />
                </div>
                {requireEmail && (
                  <p className="text-xs text-blue-600 -mt-1 ml-1">
                    El cliente recibira notificaciones del encargo
                  </p>
                )}

                <div className="relative">
                  <GraduationCap className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={quickClientData.student_name}
                    onChange={(e) =>
                      setQuickClientData({ ...quickClientData, student_name: e.target.value })
                    }
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
                  className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleQuickCreate}
                  disabled={quickCreateLoading || !quickClientData.name.trim()}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
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
                <div className="p-4 text-center text-gray-500 text-sm">
                  {searchQuery ? (
                    <>
                      No se encontraron clientes con &quot;{searchQuery}&quot;
                      <button
                        type="button"
                        onClick={() => setShowQuickCreate(true)}
                        className="block mx-auto mt-2 text-blue-600 hover:underline"
                      >
                        Crear nuevo cliente
                      </button>
                    </>
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
                      w-full px-3 py-2.5 flex items-start gap-3 hover:bg-gray-50 transition text-left
                      ${client.id === value ? 'bg-blue-50' : ''}
                    `}
                  >
                    <User
                      className={`w-5 h-5 mt-0.5 flex-shrink-0 ${client.id === value ? 'text-blue-600' : 'text-gray-400'}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`font-medium truncate ${client.id === value ? 'text-blue-900' : 'text-gray-900'}`}
                      >
                        {client.name}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                        {client.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {client.phone}
                          </span>
                        )}
                        {client.student_name && (
                          <span className="flex items-center gap-1 truncate">
                            <GraduationCap className="w-3 h-3" />
                            {client.student_name}
                          </span>
                        )}
                      </div>
                    </div>
                    {client.id === value && (
                      <Check className="w-4 h-4 text-blue-600 flex-shrink-0 mt-1" />
                    )}
                  </button>
                ))
              )}
            </div>
          )}

          {/* Results count */}
          {!showQuickCreate && filteredClients.length > 0 && (
            <div className="px-3 py-2 border-t border-gray-100 text-xs text-gray-500 text-center">
              {searchQuery
                ? `${filteredClients.length} resultado${filteredClients.length !== 1 ? 's' : ''}`
                : `Mostrando ${filteredClients.length} de ${clients.length} clientes`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
