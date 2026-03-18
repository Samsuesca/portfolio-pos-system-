import Link from 'next/link';
import Image from 'next/image';
import { School as SchoolIcon, ArrowRight, Home, AlertTriangle } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface School {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
}

async function getAvailableSchools(): Promise<School[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/schools`, {
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!res.ok) {
      return [];
    }

    return res.json();
  } catch (error) {
    console.error('Error fetching schools:', error);
    return [];
  }
}

export default async function SchoolNotFound() {
  const schools = await getAvailableSchools();

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-yellow-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary-light text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-4 hover:opacity-80 transition-opacity">
              <Image src="/logo.png" alt="Uniformes Consuelo Rios" width={64} height={64} className="h-12 sm:h-16 w-auto" style={{ width: 'auto' }} priority />
              <span className="text-lg sm:text-xl font-bold font-display text-brand-500 hidden sm:block">
                Uniformes Consuelo Rios
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* 404 Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Error Box */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-red-100 mb-6">
            <AlertTriangle className="w-12 h-12 text-red-500" />
          </div>

          <h1 className="text-8xl font-bold text-red-500 mb-4 font-display">404</h1>

          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 font-display mb-3">
            Colegio no encontrado
          </h2>

          <p className="text-gray-600 text-lg mb-8 max-w-md mx-auto">
            La URL que ingresaste no corresponde a ningún colegio registrado en nuestro sistema.
          </p>

          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary-light transition-colors font-semibold"
          >
            <Home className="w-5 h-5" />
            Volver al inicio
          </Link>
        </div>

        {/* Available Schools */}
        {schools.length > 0 && (
          <div className="bg-white rounded-2xl border border-surface-200 p-8">
            <h3 className="text-xl font-bold text-gray-800 font-display mb-2 text-center">
              Colegios disponibles
            </h3>
            <p className="text-gray-600 text-center mb-6">
              Selecciona uno de nuestros colegios registrados
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {schools.map((school) => (
                <Link
                  key={school.id}
                  href={`/${school.slug}`}
                  className="group flex items-center gap-4 p-4 bg-gray-50 rounded-xl border-2 border-gray-200 hover:border-brand-500 hover:bg-brand-50 transition-all"
                >
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center overflow-hidden flex-shrink-0 relative">
                    {school.logo_url ? (
                      <Image
                        src={`${API_BASE_URL}${school.logo_url}`}
                        alt={`Escudo ${school.name}`}
                        fill
                        sizes="56px"
                        className="object-cover"
                        unoptimized
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <SchoolIcon className={`w-7 h-7 text-brand-600 ${school.logo_url ? 'hidden' : ''}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-800 truncate group-hover:text-brand-700">
                      {school.name}
                    </h4>
                    <div className="flex items-center gap-1 text-brand-600 text-sm font-medium">
                      <span>Ver catálogo</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Help Section */}
        <div className="mt-8 text-center">
          <p className="text-gray-600 mb-4">
            ¿No encuentras tu colegio?
          </p>
          <a
            href="https://wa.me/573001234567?text=Hola, no encuentro mi colegio en el portal"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-semibold"
          >
            Contáctanos por WhatsApp
          </a>
        </div>
      </main>
    </div>
  );
}
