/**
 * Superuser-only Setting Cards
 * Schools, Users, Delivery Zones, Business Info, Payment Accounts.
 * Only rendered when the current user is a superuser.
 */
import React from 'react';
import { School, Users, Truck, Store, Wallet, Building2 } from 'lucide-react';

interface SettingsSuperuserCardsProps {
  onManageSchools: () => void;
  onManageUsers: () => void;
  onManageDeliveryZones: () => void;
  onEditBusinessInfo: () => void;
  onManagePaymentAccounts: () => void;
}

const SettingsSuperuserCards: React.FC<SettingsSuperuserCardsProps> = ({
  onManageSchools,
  onManageUsers,
  onManageDeliveryZones,
  onEditBusinessInfo,
  onManagePaymentAccounts,
}) => {
  return (
    <>
      {/* School Settings */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center mb-4">
          <School className="w-5 h-5 text-green-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-800">Colegios</h2>
        </div>
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Gestiona los colegios registrados en el sistema.</p>
          <button
            onClick={onManageSchools}
            className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition flex items-center"
          >
            <Building2 className="w-4 h-4 mr-2" />
            Administrar Colegios
          </button>
        </div>
      </div>

      {/* User Management */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center mb-4">
          <Users className="w-5 h-5 text-indigo-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-800">Usuarios</h2>
        </div>
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Gestiona los usuarios del sistema y sus permisos por colegio.</p>
          <button
            onClick={onManageUsers}
            className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition flex items-center"
          >
            <Users className="w-4 h-4 mr-2" />
            Administrar Usuarios
          </button>
        </div>
      </div>

      {/* Delivery Zones */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center mb-4">
          <Truck className="w-5 h-5 text-blue-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-800">Zonas de Envio</h2>
        </div>
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Configura las zonas de envio y sus costos para pedidos con domicilio.</p>
          <button
            onClick={onManageDeliveryZones}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center"
          >
            <Truck className="w-4 h-4 mr-2" />
            Administrar Zonas
          </button>
        </div>
      </div>

      {/* Business Info */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center mb-4">
          <Store className="w-5 h-5 text-orange-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-800">Informacion del Negocio</h2>
        </div>
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Configura nombre, telefonos, direccion, horarios y datos de contacto del negocio.</p>
          <button
            onClick={onEditBusinessInfo}
            className="mt-4 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition flex items-center"
          >
            <Store className="w-4 h-4 mr-2" />
            Editar Informacion
          </button>
        </div>
      </div>

      {/* Payment Accounts */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center mb-4">
          <Wallet className="w-5 h-5 text-violet-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-800">Cuentas de Pago</h2>
        </div>
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Configura las cuentas bancarias, Nequi y QR que se muestran a los clientes en el portal web.</p>
          <button
            onClick={onManagePaymentAccounts}
            className="mt-4 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition flex items-center"
          >
            <Wallet className="w-4 h-4 mr-2" />
            Administrar Cuentas
          </button>
        </div>
      </div>
    </>
  );
};

export default React.memo(SettingsSuperuserCards);
