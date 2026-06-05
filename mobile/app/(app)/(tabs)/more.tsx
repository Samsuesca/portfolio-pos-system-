import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../../src/stores/authStore';
import { BRAND } from '../../../src/constants/brand';
import { useSchoolStore } from '../../../src/stores/schoolStore';
import { usePermissions } from '../../../src/hooks/usePermissions';

interface MenuItemProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  subtitle?: string;
  onPress: () => void;
  destructive?: boolean;
}

function MenuItem({ icon, label, subtitle, onPress, destructive }: MenuItemProps): React.ReactElement {
  return (
    <Pressable
      className="flex-row items-center py-4 px-4 active:bg-gray-50"
      onPress={onPress}
    >
      <View className={`w-9 h-9 rounded-lg items-center justify-center ${
        destructive ? 'bg-red-100' : 'bg-primary-50'
      }`}>
        <Ionicons name={icon} size={20} color={destructive ? '#ef4444' : BRAND.primary} />
      </View>
      <View className="flex-1 ml-3">
        <Text className={`font-medium ${destructive ? 'text-red-600' : 'text-gray-900'}`}>
          {label}
        </Text>
        {subtitle && <Text className="text-xs text-gray-500">{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
    </Pressable>
  );
}

export default function MoreScreen(): React.ReactElement {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const currentSchool = useSchoolStore((s) => s.currentSchool);
  const { canViewAccounting, canViewInventory, canViewOrders, hasPermission } = usePermissions();

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="bg-white p-4 mb-3 items-center">
        <View className="w-16 h-16 rounded-full bg-primary-500 items-center justify-center mb-2">
          <Text className="text-white text-2xl font-bold">
            {(user?.full_name || user?.username || 'U').charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text className="font-bold text-gray-900 text-lg">
          {user?.full_name || user?.username}
        </Text>
        <Text className="text-sm text-gray-500">{user?.email}</Text>
        <Text className="text-xs text-gray-400 mt-1">
          {currentSchool?.name || 'Sin colegio seleccionado'}
        </Text>
      </View>

      <View className="bg-white mb-3">
        {canViewAccounting && (
          <>
            <MenuItem
              icon="calculator-outline"
              label="Contabilidad"
              subtitle="Caja, gastos, cuentas por cobrar"
              onPress={() => router.push('/(app)/accounting')}
            />
            <View className="h-px bg-gray-100 mx-4" />
          </>
        )}
        {canViewInventory && (
          <>
            <MenuItem
              icon="cube-outline"
              label="Inventario"
              subtitle="Consulta de stock por producto"
              onPress={() => router.push('/(app)/inventory')}
            />
            <View className="h-px bg-gray-100 mx-4" />
          </>
        )}
        {canViewOrders && (
          <>
            <MenuItem
              icon="clipboard-outline"
              label="Pedidos Pendientes"
              subtitle="Encargos por entregar"
              onPress={() => router.push('/(app)/orders')}
            />
            <View className="h-px bg-gray-100 mx-4" />
          </>
        )}
        {hasPermission('sales.view') && (
          <>
            <MenuItem
              icon="repeat-outline"
              label="Cambios y Devoluciones"
              subtitle="Historial de cambios de ventas"
              onPress={() => router.push('/(app)/sale-changes')}
            />
            <View className="h-px bg-gray-100 mx-4" />
          </>
        )}
        <MenuItem
          icon="school-outline"
          label="Cambiar Colegio"
          subtitle={currentSchool?.name || 'Seleccionar'}
          onPress={() => router.push('/(app)/school-selector')}
        />
      </View>

      <View className="bg-white mb-6">
        <MenuItem
          icon="log-out-outline"
          label="Cerrar Sesion"
          onPress={async () => {
            await logout();
          }}
          destructive
        />
      </View>

      <Text className="text-center text-xs text-gray-400 mb-4">
        UCR Vendedoras v1.0.0
      </Text>
    </ScrollView>
  );
}
