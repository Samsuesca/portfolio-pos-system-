/**
 * Business Info Modal
 * Multi-section form for editing business information (general, contact, address, hours, web).
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  X, AlertCircle, CheckCircle, Save, Loader2,
  Store, Phone, MapPin, Clock, Globe,
} from 'lucide-react';
import { businessInfoService, type BusinessInfo, type BusinessInfoUpdate } from '../../services/businessInfoService';
import type { BusinessInfoSection } from './types';
import {
  GeneralSection,
  ContactSection,
  AddressSection,
  HoursSection,
  WebSection,
} from './BusinessInfoSections';

interface BusinessInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SECTIONS: { key: BusinessInfoSection; label: string; icon: React.FC<{ className?: string }> }[] = [
  { key: 'general', label: 'General', icon: Store },
  { key: 'contact', label: 'Contacto', icon: Phone },
  { key: 'address', label: 'Ubicacion', icon: MapPin },
  { key: 'hours', label: 'Horarios', icon: Clock },
  { key: 'web', label: 'Web y Redes', icon: Globe },
];

const BusinessInfoModal: React.FC<BusinessInfoModalProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState<BusinessInfoUpdate>({});
  const [section, setSection] = useState<BusinessInfoSection>('general');
  const [hasChanges, setHasChanges] = useState(false);

  const loadBusinessInfo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await businessInfoService.getInfo();
      setForm(data);
      setHasChanges(false);
    } catch (err: any) {
      console.error('Error loading business info:', err);
      setError(err.response?.data?.detail || 'Error al cargar informacion');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadBusinessInfo();
      setSection('general');
      setError(null);
      setSuccess(false);
      setHasChanges(false);
    }
  }, [isOpen, loadBusinessInfo]);

  const handleChange = (key: keyof BusinessInfo, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
    setSuccess(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const updated = await businessInfoService.updateInfo(form);
      setForm(updated);
      setHasChanges(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al guardar informacion');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="text-lg font-semibold">Informacion del Negocio</h3>
            <p className="text-sm text-gray-500">Configura los datos que se muestran en toda la plataforma</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className={`px-4 py-2 rounded-lg font-medium transition flex items-center ${
                hasChanges && !saving
                  ? 'bg-orange-600 hover:bg-orange-700 text-white'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="mx-4 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center text-green-700 text-sm">
            <CheckCircle className="w-4 h-4 mr-2 flex-shrink-0" />
            Informacion guardada correctamente
          </div>
        )}

        <div className="flex-1 overflow-hidden flex">
          {/* Sidebar */}
          <div className="w-48 border-r bg-gray-50 py-2">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const isActive = section === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setSection(s.key)}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm transition ${
                    isActive
                      ? 'bg-orange-50 text-orange-700 border-l-4 border-orange-500'
                      : 'text-gray-600 hover:bg-gray-100 border-l-4 border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {s.label}
                </button>
              );
            })}
          </div>

          {/* Form Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
              </div>
            ) : (
              <>
                {section === 'general' && (
                  <GeneralSection form={form} onChange={handleChange} />
                )}
                {section === 'contact' && (
                  <ContactSection form={form} onChange={handleChange} />
                )}
                {section === 'address' && (
                  <AddressSection form={form} onChange={handleChange} />
                )}
                {section === 'hours' && (
                  <HoursSection form={form} onChange={handleChange} />
                )}
                {section === 'web' && (
                  <WebSection form={form} onChange={handleChange} />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(BusinessInfoModal);
