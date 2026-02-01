'use client';

import { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  Power,
  PowerOff,
  RefreshCw,
  Truck,
} from 'lucide-react';
import deliveryZoneService from '@/lib/services/deliveryZoneService';
import type { DeliveryZone } from '@/lib/api';

export default function DeliveryZonesPage() {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    delivery_fee: 0,
    estimated_days: 1,
    is_active: true,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadZones = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await deliveryZoneService.list();
      setZones(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al cargar zonas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadZones();
  }, []);

  const openCreateModal = () => {
    setEditingZone(null);
    setFormData({
      name: '',
      description: '',
      delivery_fee: 0,
      estimated_days: 1,
      is_active: true,
    });
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (zone: DeliveryZone) => {
    setEditingZone(zone);
    setFormData({
      name: zone.name,
      description: zone.description || '',
      delivery_fee: zone.delivery_fee || 0,
      estimated_days: zone.estimated_days,
      is_active: zone.is_active,
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);

    try {
      if (editingZone) {
        await deliveryZoneService.update(editingZone.id, formData);
      } else {
        await deliveryZoneService.create(formData);
      }
      setShowModal(false);
      loadZones();
    } catch (err: any) {
      setFormError(err.response?.data?.detail || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (zone: DeliveryZone) => {
    try {
      await deliveryZoneService.update(zone.id, {
        is_active: !zone.is_active,
      });
      loadZones();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al cambiar estado');
    }
  };

  const handleDelete = async (zone: DeliveryZone) => {
    if (!confirm(`¿Estás seguro de eliminar la zona "${zone.name}"?`)) return;

    try {
      await deliveryZoneService.delete(zone.id);
      loadZones();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al eliminar');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-display">
            Zonas de Entrega
          </h1>
          <p className="text-slate-600 mt-1">
            Configura las zonas y tarifas de envío
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadZones}
            disabled={loading}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          <button
            onClick={openCreateModal}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nueva Zona
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {error}
        </div>
      )}

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-brand-500"></div>
          </div>
        ) : zones.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white rounded-xl border border-slate-200">
            <Truck className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            <p className="text-slate-500">No hay zonas de entrega configuradas</p>
          </div>
        ) : (
          zones.map((zone) => (
            <div
              key={zone.id}
              className={`bg-white rounded-xl border p-6 ${
                zone.is_active ? 'border-slate-200' : 'border-red-200 bg-red-50'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span
                    className={`badge ${
                      zone.is_active ? 'badge-success' : 'badge-error'
                    } mb-2`}
                  >
                    {zone.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                  <h3 className="font-bold text-lg text-slate-900">{zone.name}</h3>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(zone)}
                    className="p-2 text-slate-600 hover:text-brand-600 hover:bg-slate-100 rounded-lg"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleToggleActive(zone)}
                    className={`p-2 rounded-lg ${
                      zone.is_active
                        ? 'text-orange-600 hover:bg-orange-50'
                        : 'text-green-600 hover:bg-green-50'
                    }`}
                  >
                    {zone.is_active ? (
                      <PowerOff className="w-4 h-4" />
                    ) : (
                      <Power className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(zone)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {zone.description && (
                <p className="text-sm text-slate-600 mb-4">{zone.description}</p>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Tarifa</p>
                  <p className="text-lg font-bold text-green-600">
                    {formatCurrency(zone.delivery_fee || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Tiempo estimado</p>
                  <p className="text-lg font-bold text-slate-900">
                    {zone.estimated_days}{' '}
                    {zone.estimated_days === 1 ? 'día' : 'días'}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900 mb-6">
              {editingZone ? 'Editar Zona' : 'Nueva Zona de Entrega'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="admin-label">Nombre *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="admin-input"
                  required
                  placeholder="Ej: Zona Centro"
                />
              </div>

              <div>
                <label className="admin-label">Descripción</label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="admin-input"
                  rows={2}
                  placeholder="Descripción de la zona..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="admin-label">Tarifa (COP) *</label>
                  <input
                    type="number"
                    value={formData.delivery_fee}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        delivery_fee: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="admin-input"
                    required
                    min={0}
                    step={100}
                  />
                </div>
                <div>
                  <label className="admin-label">Días estimados *</label>
                  <input
                    type="number"
                    value={formData.estimated_days}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        estimated_days: parseInt(e.target.value) || 1,
                      })
                    }
                    className="admin-input"
                    required
                    min={1}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData({ ...formData, is_active: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                />
                <span className="text-sm text-slate-600">Zona activa</span>
              </label>

              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex-1"
                >
                  {saving
                    ? 'Guardando...'
                    : editingZone
                    ? 'Guardar Cambios'
                    : 'Crear Zona'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
