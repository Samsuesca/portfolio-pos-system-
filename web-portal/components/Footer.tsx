'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
    <footer className="bg-stone-900 text-stone-400 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <Image src="/logo.png" alt="Logo" width={50} height={36} style={{ height: '2.25rem', width: 'auto' }} />
              <h3 className="text-sm font-bold text-white font-display">
                {businessInfo.business_name}
              </h3>
            </div>
            <p className="text-sm text-stone-500 leading-relaxed">
              Uniformes escolares de calidad, confeccionados con los mejores materiales.
            </p>
          </div>

          {/* Store Location */}
          <div>
            <h4 className="font-medium text-stone-300 mb-3 text-sm flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-brand-500" />
              Puntos de Venta
            </h4>
            <div className="text-sm space-y-1">
              <p className="font-medium text-stone-300">{storeLocation.name}</p>
              <p className="text-stone-500">{storeLocation.address}</p>
              <p className="text-stone-500">{storeLocation.neighborhood}</p>
              <p className="text-stone-600 text-xs">{storeLocation.city}</p>
              <div className="flex items-center gap-1 text-xs text-stone-500 mt-1.5">
                <Clock className="w-3 h-3" />
                {storeLocation.hours}
              </div>
              <a
                href={storeLocation.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 mt-2 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Ver en Google Maps
              </a>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-medium text-stone-300 mb-3 text-sm">Contacto</h4>
            <div className="space-y-2.5 text-sm">
              <a
                href={`https://wa.me/${businessInfo.whatsapp_number}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-stone-500 hover:text-green-400 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                {businessInfo.phone_main}
              </a>
              <a
                href={`tel:${businessInfo.phone_main.replace(/[^\d+]/g, '')}`}
                className="flex items-center gap-2 text-stone-500 hover:text-stone-300 transition-colors"
              >
                <Phone className="w-4 h-4" />
                Llamar
              </a>
              <a
                href={`mailto:${businessInfo.email_contact}`}
                className="flex items-center gap-2 text-stone-500 hover:text-stone-300 transition-colors"
              >
                <Mail className="w-4 h-4" />
                {businessInfo.email_contact}
              </a>
            </div>
          </div>

          {/* Help */}
          <div>
            <h4 className="font-medium text-stone-300 mb-3 text-sm">Ayuda</h4>
            <div className="space-y-2.5 text-sm">
              <Link
                href="/soporte"
                className="flex items-center gap-2 text-stone-500 hover:text-stone-300 transition-colors"
              >
                <HelpCircle className="w-4 h-4" />
                Centro de Soporte
              </Link>
              <p className="text-stone-600 text-xs mt-2">
                {businessInfo.hours_weekday}<br />
                {businessInfo.hours_saturday}
              </p>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-stone-800 pt-6 text-center">
          <p className="text-stone-600 text-xs">
            © {currentYear} {businessInfo.business_name}. Todos los derechos reservados.
          </p>
          <p className="text-stone-700 text-[10px] mt-1">
            v{SYSTEM_VERSION} | Portal v{APP_VERSION}
          </p>
        </div>
      </div>
    </footer>
  );
}
