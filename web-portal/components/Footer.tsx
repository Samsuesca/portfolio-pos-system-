'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Phone, Mail, MessageCircle, HelpCircle, MapPin, Clock, ExternalLink } from 'lucide-react';
import { SYSTEM_VERSION, APP_VERSION } from '@/lib/version';
import { type BusinessInfo, DEFAULT_BUSINESS_INFO } from '@/lib/businessInfo';
import { API_BASE_URL } from '@/lib/api';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>(DEFAULT_BUSINESS_INFO);

  useEffect(() => {
    // Fetch business info on mount
    const fetchBusinessInfo = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/business-info`);
        if (response.ok) {
          const data = await response.json();
          setBusinessInfo(data);
        }
      } catch (error) {
        console.warn('[Footer] Failed to fetch business info, using defaults');
      }
    };

    fetchBusinessInfo();
  }, []);

  // Build store location from business info
  const storeLocation = {
    name: 'Sede Principal - Boston',
    address: businessInfo.address_line1,
    neighborhood: businessInfo.address_line2,
    city: `${businessInfo.city}, ${businessInfo.state}`,
    googleMapsUrl: businessInfo.maps_url,
    hours: `${businessInfo.hours_weekday.replace('Lunes a Viernes: ', 'L-V: ')} | ${businessInfo.hours_saturday.replace('Sábados: ', 'Sáb: ')}`
  };

  return (
    <footer className="bg-white border-t border-surface-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <img src="/logo.png" alt="Logo" className="h-10 w-auto" />
              <h3 className="text-lg font-bold text-primary font-display">
                {businessInfo.business_name}
              </h3>
            </div>
            <p className="text-sm text-slate-600">
              Uniformes escolares de calidad, confeccionados con los mejores materiales.
            </p>
          </div>

          {/* Store Location */}
          <div>
            <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-brand-600" />
              Puntos de Venta
            </h4>
            <div className="space-y-4">
              <div className="text-sm">
                <p className="font-medium text-slate-700">{storeLocation.name}</p>
                <p className="text-slate-600">{storeLocation.address}</p>
                <p className="text-slate-600">{storeLocation.neighborhood}</p>
                <p className="text-slate-500 text-xs">{storeLocation.city}</p>
                <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                  <Clock className="w-3 h-3" />
                  {storeLocation.hours}
                </div>
                <a
                  href={storeLocation.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 mt-2 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  Ver en Google Maps
                </a>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold text-slate-700 mb-3">Contacto</h4>
            <div className="space-y-2 text-sm">
              <a
                href={`https://wa.me/${businessInfo.whatsapp_number}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-slate-600 hover:text-green-600 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                {businessInfo.phone_main}
              </a>
              <a
                href={`tel:${businessInfo.phone_main.replace(/[^\d+]/g, '')}`}
                className="flex items-center gap-2 text-slate-600 hover:text-brand-600 transition-colors"
              >
                <Phone className="w-4 h-4" />
                Llamar
              </a>
              <a
                href={`mailto:${businessInfo.email_contact}`}
                className="flex items-center gap-2 text-slate-600 hover:text-brand-600 transition-colors"
              >
                <Mail className="w-4 h-4" />
                {businessInfo.email_contact}
              </a>
            </div>
          </div>

          {/* Help */}
          <div>
            <h4 className="font-semibold text-slate-700 mb-3">Ayuda</h4>
            <div className="space-y-2 text-sm">
              <Link
                href="/soporte"
                className="flex items-center gap-2 text-slate-600 hover:text-brand-600 transition-colors"
              >
                <HelpCircle className="w-4 h-4" />
                Centro de Soporte
              </Link>
              <p className="text-slate-500 text-xs mt-2">
                {businessInfo.hours_weekday}<br />
                {businessInfo.hours_saturday}
              </p>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-surface-200 pt-6 text-center">
          <p className="text-slate-500 text-sm">
            © {currentYear} {businessInfo.business_name}. Todos los derechos reservados.
          </p>
          <p className="text-slate-400 text-xs mt-1">
            v{SYSTEM_VERSION} | Portal v{APP_VERSION}
          </p>
        </div>
      </div>
    </footer>
  );
}
