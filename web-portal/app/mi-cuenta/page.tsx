'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Package, User, Clock, CheckCircle, AlertCircle, XCircle, Truck, Calendar, DollarSign, Upload, Globe, Store } from 'lucide-react';
import { useClientAuth, getStatusLabel, getStatusColor, getSourceLabel, getPaymentProofStatusLabel, getPaymentProofStatusColor, type ClientOrder } from '@/lib/clientAuth';
import { formatNumber } from '@/lib/utils';
import UploadPaymentProofModal from '@/components/UploadPaymentProofModal';

export default function MiCuentaPage() {
  const router = useRouter();
  const { client, isAuthenticated, logout, getOrders } = useClientAuth();
  const [orders, setOrders] = useState<ClientOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ClientOrder | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedOrderForUpload, setSelectedOrderForUpload] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isAuthenticated) {
      router.push('/');
    }
  }, [mounted, isAuthenticated, router]);

  useEffect(() => {
    if (mounted && isAuthenticated) {
      loadOrders();
    }
  }, [mounted, isAuthenticated]);

  const loadOrders = async () => {
    console.log('[MiCuenta] loadOrders() called');
    setLoading(true);
    try {
      const ordersList = await getOrders();
      console.log('[MiCuenta] Orders loaded:', ordersList.length, ordersList);
      setOrders(ordersList);
    } catch (error) {
      console.error('[MiCuenta] Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5" />;
      case 'in_production':
        return <AlertCircle className="w-5 h-5" />;
      case 'ready':
        return <CheckCircle className="w-5 h-5" />;
      case 'delivered':
        return <Truck className="w-5 h-5" />;
      case 'cancelled':
        return <XCircle className="w-5 h-5" />;
      default:
        return <Package className="w-5 h-5" />;
    }
  };

  if (!mounted) {
    return null;
  }

  if (!isAuthenticated || !client) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-primary text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Volver al inicio</span>
            </button>
            <button
              onClick={logout}
              className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors text-sm"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-brand-600/20 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-brand-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{client.name}</h1>
              <p className="text-gray-300">{client.email}</p>
              {client.phone && <p className="text-gray-300 text-sm">{client.phone}</p>}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-brand-50 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-brand-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{orders.length}</p>
                <p className="text-gray-500 text-sm">Total Pedidos</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">
                  {orders.filter(o => ['pending', 'in_production'].includes(o.status)).length}
                </p>
                <p className="text-gray-500 text-sm">En Proceso</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">
                  {orders.filter(o => o.status === 'delivered').length}
                </p>
                <p className="text-gray-500 text-sm">Entregados</p>
              </div>
            </div>
          </div>
        </div>

        {/* Orders List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-800">Mis Pedidos</h2>
            <p className="text-gray-500 text-sm mt-1">Historial completo de tus pedidos</p>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-brand-200 border-t-brand-600"></div>
              <p className="mt-4 text-gray-500">Cargando pedidos...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No tienes pedidos aún</p>
              <p className="text-gray-400 text-sm mt-2">
                Tus pedidos aparecerán aquí cuando hagas una compra
              </p>
              <button
                onClick={() => router.push('/')}
                className="mt-6 px-6 py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors font-semibold"
              >
                Explorar Catálogo
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="p-6 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`p-3 rounded-lg ${getStatusColor(order.status)}`}>
                        {getStatusIcon(order.status)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="font-bold text-gray-800">{order.code}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}>
                            {getStatusLabel(order.status)}
                          </span>
                          {/* Origen del pedido */}
                          <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
                            order.source === 'web_portal'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {order.source === 'web_portal' ? (
                              <Globe className="w-3 h-3" />
                            ) : (
                              <Store className="w-3 h-3" />
                            )}
                            {getSourceLabel(order.source)}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(order.created_at).toLocaleDateString('es-CO', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Package className="w-4 h-4" />
                            {order.items_count} {order.items_count === 1 ? 'producto' : 'productos'}
                          </span>
                        </div>

                        {/* Payment Status - Solo mostrar para pedidos web */}
                        {order.source === 'web_portal' && (
                          <div className="mt-3">
                            {order.payment_proof_url ? (
                              <div className="flex items-center gap-2 flex-wrap">
                                {/* Estado del comprobante */}
                                <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 border ${getPaymentProofStatusColor(order.payment_proof_status)}`}>
                                  {order.payment_proof_status === 'approved' ? (
                                    <CheckCircle className="w-4 h-4" />
                                  ) : order.payment_proof_status === 'rejected' ? (
                                    <XCircle className="w-4 h-4" />
                                  ) : (
                                    <Clock className="w-4 h-4" />
                                  )}
                                  <span className="font-medium">{getPaymentProofStatusLabel(order.payment_proof_status)}</span>
                                </div>
                                {/* Mostrar botón de cambiar solo si está pendiente o rechazado */}
                                {order.payment_proof_status !== 'approved' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedOrderForUpload(order.id);
                                      setShowUploadModal(true);
                                    }}
                                    className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 hover:bg-blue-100 transition-colors font-medium"
                                  >
                                    <Upload className="w-4 h-4" />
                                    <span>Cambiar comprobante</span>
                                  </button>
                                )}
                              </div>
                            ) : order.payment_proof_status === 'rejected' ? (
                              // El comprobante fue rechazado y eliminado, mostrar mensaje y botón
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                  <XCircle className="w-4 h-4" />
                                  <span className="font-medium">Comprobante rechazado - Sube uno nuevo</span>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedOrderForUpload(order.id);
                                    setShowUploadModal(true);
                                  }}
                                  className="flex items-center gap-2 text-sm text-brand-700 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2 hover:bg-brand-100 transition-colors font-medium"
                                >
                                  <Upload className="w-4 h-4" />
                                  <span>Subir nuevo comprobante</span>
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedOrderForUpload(order.id);
                                  setShowUploadModal(true);
                                }}
                                className="flex items-center gap-2 text-sm text-brand-700 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2 hover:bg-brand-100 transition-colors font-medium"
                              >
                                <Upload className="w-4 h-4" />
                                <span>Subir comprobante de pago</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-gray-800">
                        ${formatNumber(order.total)}
                      </p>
                      {order.balance > 0 && (
                        <p className="text-sm text-red-600 flex items-center justify-end gap-1 mt-1">
                          <DollarSign className="w-4 h-4" />
                          Saldo: ${formatNumber(order.balance)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Order Details (Expandable) */}
                  {selectedOrder?.id === order.id && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <h4 className="font-semibold text-gray-700 mb-4">Detalle del Pedido</h4>
                      <div className="space-y-3">
                        {order.items.map((item, index) => (
                          <div
                            key={item.id || index}
                            className="flex items-center justify-between bg-gray-50 rounded-lg p-4"
                          >
                            <div>
                              <p className="font-medium text-gray-800">
                                {item.quantity}x Producto
                              </p>
                              <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                                {item.size && <span>Talla: {item.size}</span>}
                                {item.color && <span>Color: {item.color}</span>}
                              </div>
                            </div>
                            <p className="font-semibold text-gray-800">
                              ${formatNumber(item.subtotal)}
                            </p>
                          </div>
                        ))}
                      </div>

                      {order.delivery_date && (
                        <div className="mt-4 p-4 bg-brand-50 rounded-lg">
                          <p className="text-sm text-gray-800">
                            <span className="font-semibold">Fecha de entrega estimada:</span>{' '}
                            {new Date(order.delivery_date).toLocaleDateString('es-CO', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Help Section */}
        <div className="mt-8 bg-brand-50 rounded-xl p-6 border border-brand-200">
          <h3 className="font-bold text-gray-800 mb-2">¿Necesitas ayuda?</h3>
          <p className="text-gray-600 text-sm mb-4">
            Si tienes preguntas sobre tus pedidos o necesitas hacer cambios, contáctanos.
          </p>
          <button
            onClick={() => router.push('/soporte')}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-semibold"
          >
            Ir a Soporte
          </button>
        </div>
      </main>

      {/* Upload Payment Proof Modal */}
      {selectedOrderForUpload && (
        <UploadPaymentProofModal
          isOpen={showUploadModal}
          onClose={() => {
            setShowUploadModal(false);
            setSelectedOrderForUpload(null);
          }}
          orderId={selectedOrderForUpload}
          onUploadSuccess={() => {
            console.log('[MiCuenta] Upload success callback triggered');
            // Force immediate reload
            loadOrders();
            setShowUploadModal(false);
            setSelectedOrderForUpload(null);
          }}
        />
      )}
    </div>
  );
}
