import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { orderService } from '../../src/services/orderService';
import { useCurrentSchoolId } from '../../src/stores/schoolStore';
import { usePermissions } from '../../src/hooks/usePermissions';
import { formatCurrency, formatDate, formatOrderStatus } from '../../src/utils/format';
import { extractErrorMessage } from '../../src/utils/apiClient';
import { BRAND } from '../../src/constants/brand';
import type { OrderListItem } from '../../src/types/api';

const statusColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-amber-100', text: 'text-amber-700' },
  in_production: { bg: 'bg-blue-100', text: 'text-blue-700' },
  ready: { bg: 'bg-green-100', text: 'text-green-700' },
  delivered: { bg: 'bg-gray-100', text: 'text-gray-500' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700' },
};

export default function OrdersScreen(): React.ReactElement {
  const router = useRouter();
  const schoolId = useCurrentSchoolId();
  const { canDeliverOrders, hasPermission } = usePermissions();
  const qc = useQueryClient();

  const { data: orders, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['orders', schoolId],
    queryFn: () =>
      orderService
        .list({
          school_id: schoolId || undefined,
          status: 'pending,in_production,ready',
          limit: 100,
        })
        .then((r) => r.data.items),
  });

  const deliverMutation = useMutation({
    mutationFn: ({ orderId }: { orderId: string }) =>
      orderService.updateStatus(schoolId!, orderId, 'delivered'),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Pedido marcado como entregado' });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
    onError: (error) => {
      Toast.show({ type: 'error', text1: 'Error', text2: extractErrorMessage(error) });
    },
  });

  return (
    <View className="flex-1 bg-gray-50">
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={BRAND.primary} />
        </View>
      ) : (
        <FlatList
          data={orders || []}
          keyExtractor={(item) => item.id}
          contentContainerClassName="p-4"
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />
          }
          renderItem={({ item }: { item: OrderListItem }) => {
            const colors = statusColors[item.status] || statusColors.pending;
            return (
              <Pressable
                className="bg-white rounded-xl p-4 mb-3 border border-gray-100 active:bg-gray-50"
                onPress={() =>
                  router.push({ pathname: '/(app)/order-detail', params: { id: item.id } })
                }
              >
                <View className="flex-row justify-between items-start mb-2">
                  <View className="flex-1">
                    <Text className="font-semibold text-gray-900">#{item.code}</Text>
                    <Text className="text-sm text-gray-500">{item.client_name || 'Sin cliente'}</Text>
                  </View>
                  <Text className="font-bold text-gray-900">{formatCurrency(Number(item.total))}</Text>
                </View>

                <View className="flex-row items-center justify-between mb-2">
                  <View className={`px-2 py-0.5 rounded-full ${colors.bg}`}>
                    <Text className={`text-xs font-medium ${colors.text}`}>
                      {formatOrderStatus(item.status)}
                    </Text>
                  </View>
                  <Text className="text-xs text-gray-400">
                    {item.items_delivered}/{item.items_total} entregados
                  </Text>
                </View>

                {item.delivery_date && (
                  <Text className="text-xs text-gray-400">
                    Entrega: {formatDate(item.delivery_date)}
                  </Text>
                )}

                {item.status === 'ready' && schoolId && canDeliverOrders && (
                  <Pressable
                    className="bg-green-600 rounded-lg py-2 mt-3 items-center active:bg-green-700"
                    onPress={() => deliverMutation.mutate({ orderId: item.id })}
                    disabled={deliverMutation.isPending}
                  >
                    {deliverMutation.isPending ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text className="text-white font-semibold text-sm">Marcar Entregado</Text>
                    )}
                  </Pressable>
                )}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View className="py-20 items-center">
              <Ionicons name="clipboard-outline" size={48} color="#d1d5db" />
              <Text className="text-gray-400 mt-2">No hay pedidos pendientes</Text>
            </View>
          }
        />
      )}

      {hasPermission('orders.create') && (
        <Pressable
          className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-primary-500 items-center justify-center"
          style={{ elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 }}
          onPress={() => router.push('/(app)/new-order')}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}
