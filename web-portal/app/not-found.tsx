import Link from 'next/link';
import { Home, AlertTriangle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-yellow-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary-light text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-4 hover:opacity-80 transition-opacity">
              <img src="/logo.png" alt="Uniformes Consuelo Rios" className="h-12 sm:h-16 w-auto" />
              <span className="text-lg sm:text-xl font-bold font-display text-brand-500 hidden sm:block">
                Uniformes Consuelo Rios
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* 404 Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-red-100 mb-6">
            <AlertTriangle className="w-12 h-12 text-red-500" />
          </div>

          <h1 className="text-8xl font-bold text-red-500 mb-4 font-display">404</h1>

          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 font-display mb-3">
            Página no encontrada
          </h2>

          <p className="text-gray-600 text-lg mb-8 max-w-md mx-auto">
            La página que buscas no existe o ha sido movida.
          </p>

          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary-light transition-colors font-semibold"
          >
            <Home className="w-5 h-5" />
            Volver al inicio
          </Link>
        </div>
      </main>
    </div>
  );
}
