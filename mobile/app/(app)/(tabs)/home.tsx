import { View, Text, Pressable, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { schoolService } from '../../../src/services/schoolService';
import { useSchoolStore } from '../../../src/stores/schoolStore';
import { useAuthStore } from '../../../src/stores/authStore';
import { usePermissions } from '../../../src/hooks/usePermissions';
import { formatCurrency } from '../../../src/utils/format';
import { BRAND } from '../../../src/constants/brand';

function StatCard({ title, value, icon, color }: {
  title: string;
  value: string | number;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
}): React.ReactElement {
  return (
    <View className="bg-white rounded-xl p-4 flex-1 mr-3 shadow-sm border border-gray-100">
      <View className="flex-row items-center mb-2">
        <View className={`w-8 h-8 rounded-lg items-center justify-center ${color}`}>
          <Ionicons name={icon} size={16} color="#fff" />
        </View>
      </View>
      <Text className="text-xl font-bold text-gray-900">{value}</Text>
      <Text className="text-xs text-gray-500 mt-1">{title}</Text>
    </View>
  );
}

export default function HomeScreen(): React.ReactElement {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const currentSchool = useSchoolStore((s) => s.currentSchool);
  const {
    canCreateSales, canViewOrders, canViewInventory,
    canCreateClients, canViewDashboard,
  } = usePermissions();

  const { data: stats, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => schoolService.getDashboardStats().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const schoolStats = stats?.schools_summary?.find(
    (s) => s.school_id === currentSchool?.id
  );

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
    >
      <View className="px-4 pt-4 pb-2">
        <Text className="text-lg font-bold text-gray-900">
          Hola, {user?.full_name?.split(' ')[0] || user?.username}
        </Text>
        <Pressable
          className="flex-row items-center mt-1"
          onPress={() => router.push('/(app)/school-selector')}
        >
          <Ionicons name="school-outline" size={14} color="#6b7280" />
          <Text className="text-sm text-gray-500 ml-1">
            {currentSchool?.name || 'Seleccionar colegio'}
          </Text>
          <Ionicons name="chevron-down" size={14} color="#6b7280" />
        </Pressable>
      </View>

      {isLoading ? (
        <View className="py-20 items-center">
          <ActivityIndicator size="large" color={BRAND.primary} />
        </View>
      ) : (
        <View className="px-4 pt-2">
          <Text className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">
            Resumen del Mes
          </Text>

          <View className="flex-row mb-3">
            <StatCard
              title="Ventas del mes"
              value={formatCurrency(schoolStats?.sales_amount || stats?.totals.sales_amount_month || 0)}
              icon="cash-outline"
              color="bg-green-500"
            />
            <StatCard
              title="Cantidad ventas"
              value={schoolStats?.sales_count || stats?.totals.total_sales || 0}
              icon="receipt-outline"
              color="bg-primary-600"
            />
          </View>

          <View className="flex-row mb-3">
            <StatCard
              title="Pedidos pendientes"
              value={schoolStats?.pending_orders || stats?.totals.pending_orders || 0}
              icon="time-outline"
              color="bg-amber-500"
            />
            <StatCard
              title="Clientes totales"
              value={stats?.totals.total_clients || 0}
              icon="people-outline"
              color="bg-primary-400"
            />
          </View>

          <Text className="text-sm font-semibold text-gray-600 mb-3 mt-4 uppercase tracking-wide">
            Acciones Rapidas
          </Text>

          <View className="flex-row mb-3">
            {canCreateSales && (
              <Pressable
                className="bg-primary-500 rounded-xl p-4 flex-1 mr-3 active:bg-primary-600"
                onPress={() => router.push('/(app)/new-sale')}
              >
                <Ionicons name="add-circle-outline" size={24} color="#fff" />
                <Text className="text-white font-semibold mt-2">Nueva Venta</Text>
              </Pressable>
            )}

            {canViewOrders && (
              <Pressable
                className="bg-white rounded-xl p-4 flex-1 border border-gray-200 active:bg-gray-50"
                onPress={() => router.push('/(app)/orders')}
              >
                <Ionicons name="clipboard-outline" size={24} color={BRAND.primary} />
                <Text className="text-gray-900 font-semibold mt-2">Pedidos</Text>
              </Pressable>
            )}
          </View>

          <View className="flex-row mb-6">
            {canViewInventory && (
              <Pressable
                className="bg-white rounded-xl p-4 flex-1 mr-3 border border-gray-200 active:bg-gray-50"
                onPress={() => router.push('/(app)/inventory')}
              >
                <Ionicons name="cube-outline" size={24} color={BRAND.primary} />
                <Text className="text-gray-900 font-semibold mt-2">Inventario</Text>
              </Pressable>
            )}

            {canCreateClients && (
              <Pressable
                className="bg-white rounded-xl p-4 flex-1 border border-gray-200 active:bg-gray-50"
                onPress={() => router.push('/(app)/new-client')}
              >
                <Ionicons name="person-add-outline" size={24} color={BRAND.primary} />
                <Text className="text-gray-900 font-semibold mt-2">Nuevo Cliente</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
}
