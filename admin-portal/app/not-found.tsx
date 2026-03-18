import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <p className="text-8xl font-bold text-brand-500 mb-4 font-display">404</p>
        <h1 className="text-2xl font-bold text-white mb-2 font-display">
          Página no encontrada
        </h1>
        <p className="text-slate-400 mb-8">
          La página que buscas no existe o fue movida.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl font-semibold shadow-lg shadow-brand-500/25 hover:shadow-xl hover:shadow-brand-500/30 transition-all duration-200"
        >
          Volver al Panel
        </Link>
        <p className="text-xs text-slate-500 mt-8">
          Uniformes Consuelo Rios — Panel de Administración
        </p>
      </div>
    </div>
  );
}
