/**
 * Manage Delivery Zones Modal
 * Lists delivery zones and provides create/edit sub-modal for zone forms.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Plus, Edit2, CheckCircle, XCircle, Loader2,
  Truck, AlertCircle, Save,
} from 'lucide-react';
import {
  deliveryZoneService,
  type DeliveryZone,
  type DeliveryZoneCreate,
  type DeliveryZoneUpdate,
} from '../../services/deliveryZoneService';

type ZoneView = 'list' | 'create' | 'edit';

interface ManageDeliveryZonesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ManageDeliveryZonesModal: React.FC<ManageDeliveryZonesModalProps> = ({ isOpen, onClose }) => {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<ZoneView>('list');
  const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(null);
  const [zoneForm, setZoneForm] = useState<DeliveryZoneCreate>({
    name: '',
    description: '',
    delivery_fee: 0,
    estimated_days: 1,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadZones = useCallback(async () => {
    setLoading(true);
    try {
      const data = await deliveryZoneService.getZones(true);
      setZones(data);
    } catch (err: any) {
      console.error('Error loading delivery zones:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadZones();
      setView('list');
      setError(null);
    }
  }, [isOpen, loadZones]);

  const handleOpenCreate = () => {
    setZoneForm({ name: '', description: '', delivery_fee: 0, estimated_days: 1 });
    setError(null);
    setView('create');
  };

  const handleOpenEdit = (zone: DeliveryZone) => {
    setSelectedZone(zone);
    setZoneForm({
      name: zone.name,
      description: zone.description || '',
      delivery_fee: zone.delivery_fee,
      estimated_days: zone.estimated_days,
    });
    setError(null);
    setView('edit');
  };

  const handleSaveZone = async () => {
    setSaving(true);
    setError(null);

    try {
      if (view === 'create') {
        await deliveryZoneService.createZone(zoneForm);
      } else if (selectedZone) {
        const updateData: DeliveryZoneUpdate = {
          name: zoneForm.name,
          description: zoneForm.description || undefined,
          delivery_fee: zoneForm.delivery_fee,
          estimated_days: zoneForm.estimated_days,
        };
        await deliveryZoneService.updateZone(selectedZone.id, updateData);
      }
      await loadZones();
      setView('list');
      setZoneForm({ name: '', description: '', delivery_fee: 0, estimated_days: 1 });
      setSelectedZone(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al guardar zona');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (zone: DeliveryZone) => {
    try {
      if (zone.is_active) {
        await deliveryZoneService.deleteZone(zone.id);
      } else {
        await deliveryZoneService.updateZone(zone.id, { is_active: true });
      }
      await loadZones();
    } catch (err: any) {
      console.error('Error toggling zone:', err);
    }
  };

  const handleBackToList = () => {
    setView('list');
    setError(null);
    setZoneForm({ name: '', description: '', delivery_fee: 0, estimated_days: 1 });
    setSelectedZone(null);
  };

  if (!isOpen) return null;

  // Zone form (create or edit)
  if (view === 'create' || view === 'edit') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-lg font-semibold">
              {view === 'create' ? 'Nueva Zona de Envio' : 'Editar Zona de Envio'}
            </h3>
            <button onClick={handleBackToList} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input
                type="text"
                value={zoneForm.name}
                onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ej: Zona Norte"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
              <textarea
                value={zoneForm.description}
                onChange={(e) => setZoneForm({ ...zoneForm, description: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Ej: Barrios incluidos en esta zona"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Costo de Envio *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="number"
                  min="0"
                  value={zoneForm.delivery_fee || ''}
                  onChange={(e) => setZoneForm({ ...zoneForm, delivery_fee: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="8000"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dias Estimados *</label>
              <input
                type="number"
                min="1"
                value={zoneForm.estimated_days || ''}
                onChange={(e) => setZoneForm({ ...zoneForm, estimated_days: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="1"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 p-4 border-t">
            <button onClick={handleBackToList} className="px-4 py-2 text-gray-600 hover:text-gray-800 transition">
              Cancelar
            </button>
            <button
              onClick={handleSaveZone}
              disabled={saving || !zoneForm.name || zoneForm.delivery_fee < 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Zone list view
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Administrar Zonas de Envio</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenCreate}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center"
            >
              <Plus className="w-4 h-4 mr-1" />
              Nueva Zona
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Cargando zonas...</span>
            </div>
          ) : zones.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No hay zonas de envio registradas</div>
          ) : (
            <div className="space-y-3">
              {zones.map((zone) => (
                <div key={zone.id} className={`p-4 border rounded-lg ${zone.is_active ? 'bg-white' : 'bg-gray-50'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Truck className="w-5 h-5 text-blue-500" />
                        <span className="font-medium text-gray-800">{zone.name}</span>
                        {!zone.is_active && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs">Inactiva</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 mt-1 ml-7">
                        {zone.description && <span>{zone.description}</span>}
                      </div>
                      <div className="flex items-center gap-4 mt-2 ml-7">
                        <span className="text-sm font-medium text-green-600">
                          ${zone.delivery_fee.toLocaleString()}
                        </span>
                        <span className="text-sm text-gray-500">
                          {zone.estimated_days} dia{zone.estimated_days > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEdit(zone)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(zone)}
                        className={`p-2 rounded-lg transition ${
                          zone.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'
                        }`}
                        title={zone.is_active ? 'Desactivar' : 'Activar'}
                      >
                        {zone.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(ManageDeliveryZonesModal);
