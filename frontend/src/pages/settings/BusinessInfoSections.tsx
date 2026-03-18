/**
 * Business Info Form Sections
 * Individual form groups for the BusinessInfoModal sidebar tabs.
 */
import React from 'react';
import type { BusinessInfo, BusinessInfoUpdate } from '../../services/businessInfoService';

export interface SectionProps {
  form: BusinessInfoUpdate;
  onChange: (key: keyof BusinessInfo, value: string) => void;
}

export const GeneralSection: React.FC<SectionProps> = ({ form, onChange }) => (
  <div className="space-y-4">
    <h4 className="text-lg font-semibold text-gray-800 mb-4">Informacion General</h4>
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Negocio</label>
        <input
          type="text"
          value={form.business_name || ''}
          onChange={(e) => onChange('business_name', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          placeholder="Uniformes Consuelo Rios"
        />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Corto</label>
        <input
          type="text"
          value={form.business_name_short || ''}
          onChange={(e) => onChange('business_name_short', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          placeholder="UCR"
        />
        <p className="text-xs text-gray-500 mt-1">Se usa en espacios reducidos</p>
      </div>
      <div className="col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Eslogan</label>
        <input
          type="text"
          value={form.tagline || ''}
          onChange={(e) => onChange('tagline', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          placeholder="Sistema de Gestion"
        />
      </div>
    </div>
  </div>
);

export const ContactSection: React.FC<SectionProps> = ({ form, onChange }) => (
  <div className="space-y-4">
    <h4 className="text-lg font-semibold text-gray-800 mb-4">Informacion de Contacto</h4>
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Telefono Principal</label>
        <input
          type="tel"
          value={form.phone_main || ''}
          onChange={(e) => onChange('phone_main', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          placeholder="+57 300 123 4567"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Telefono Soporte</label>
        <input
          type="tel"
          value={form.phone_support || ''}
          onChange={(e) => onChange('phone_support', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          placeholder="+57 301 568 7810"
        />
      </div>
      <div className="col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
        <input
          type="tel"
          value={form.whatsapp_number || ''}
          onChange={(e) => onChange('whatsapp_number', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          placeholder="573001234567"
        />
        <p className="text-xs text-gray-500 mt-1">Sin + ni espacios (para links de WhatsApp)</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email de Contacto</label>
        <input
          type="email"
          value={form.email_contact || ''}
          onChange={(e) => onChange('email_contact', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          placeholder="correo@ejemplo.com"
        />
        <p className="text-xs text-gray-500 mt-1">Email publico</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email de Envio</label>
        <input
          type="email"
          value={form.email_noreply || ''}
          onChange={(e) => onChange('email_noreply', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          placeholder="noreply@ejemplo.com"
        />
        <p className="text-xs text-gray-500 mt-1">Para notificaciones</p>
      </div>
    </div>
  </div>
);

export const AddressSection: React.FC<SectionProps> = ({ form, onChange }) => (
  <div className="space-y-4">
    <h4 className="text-lg font-semibold text-gray-800 mb-4">Ubicacion</h4>
    <div className="grid grid-cols-1 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Direccion Linea 1</label>
        <input
          type="text"
          value={form.address_line1 || ''}
          onChange={(e) => onChange('address_line1', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          placeholder="Calle 56 D #26 BE 04"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Direccion Linea 2</label>
        <input
          type="text"
          value={form.address_line2 || ''}
          onChange={(e) => onChange('address_line2', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          placeholder="Barrio, Sector"
        />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
          <input
            type="text"
            value={form.city || ''}
            onChange={(e) => onChange('city', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="Medellin"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Departamento</label>
          <input
            type="text"
            value={form.state || ''}
            onChange={(e) => onChange('state', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="Antioquia"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pais</label>
          <input
            type="text"
            value={form.country || ''}
            onChange={(e) => onChange('country', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="Colombia"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">URL Google Maps</label>
        <input
          type="url"
          value={form.maps_url || ''}
          onChange={(e) => onChange('maps_url', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          placeholder="https://google.com/maps/..."
        />
        <p className="text-xs text-gray-500 mt-1">Link para abrir en Maps</p>
      </div>
    </div>
  </div>
);

export const HoursSection: React.FC<SectionProps> = ({ form, onChange }) => (
  <div className="space-y-4">
    <h4 className="text-lg font-semibold text-gray-800 mb-4">Horarios de Atencion</h4>
    <div className="grid grid-cols-1 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Lunes a Viernes</label>
        <input
          type="text"
          value={form.hours_weekday || ''}
          onChange={(e) => onChange('hours_weekday', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          placeholder="Lunes a Viernes: 8:00 AM - 6:00 PM"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Sabados</label>
        <input
          type="text"
          value={form.hours_saturday || ''}
          onChange={(e) => onChange('hours_saturday', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          placeholder="Sabados: 9:00 AM - 2:00 PM"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Domingos</label>
        <input
          type="text"
          value={form.hours_sunday || ''}
          onChange={(e) => onChange('hours_sunday', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          placeholder="Domingos: Cerrado"
        />
      </div>
    </div>
  </div>
);

export const WebSection: React.FC<SectionProps> = ({ form, onChange }) => (
  <div className="space-y-4">
    <h4 className="text-lg font-semibold text-gray-800 mb-4">Web y Redes Sociales</h4>
    <div className="grid grid-cols-1 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Sitio Web</label>
        <input
          type="url"
          value={form.website_url || ''}
          onChange={(e) => onChange('website_url', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          placeholder="https://ejemplo.com"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Facebook</label>
        <input
          type="url"
          value={form.social_facebook || ''}
          onChange={(e) => onChange('social_facebook', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          placeholder="https://facebook.com/..."
        />
        <p className="text-xs text-gray-500 mt-1">Dejar vacio si no aplica</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Instagram</label>
        <input
          type="url"
          value={form.social_instagram || ''}
          onChange={(e) => onChange('social_instagram', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          placeholder="https://instagram.com/..."
        />
        <p className="text-xs text-gray-500 mt-1">Dejar vacio si no aplica</p>
      </div>
    </div>
  </div>
);
