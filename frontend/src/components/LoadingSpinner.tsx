const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-surface-50">
    <div className="text-center">
      <div className="w-10 h-10 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
      <p className="text-sm text-gray-500">Cargando...</p>
    </div>
  </div>
);

export default LoadingSpinner;
