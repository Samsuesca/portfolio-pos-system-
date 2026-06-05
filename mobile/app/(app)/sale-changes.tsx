import { useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { saleChangeService } from '../../src/services/saleChangeService';
import { formatCurrency, formatDateRelative, formatChangeType, formatChangeStatus } from '../../src/utils/format';
import { BRAND } from '../../src/constants/brand';
import type { SaleChangeListItem, ChangeStatus } from '../../src/types/api';

const STATUS_FILTERS: { key: ChangeStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'pending', label: 'Pendientes' },
  { key: 'approved', label: 'Aprobados' },
  { key: 'rejected', label: 'Rechazados' },
];

const statusColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-amber-100', text: 'text-amber-700' },
  pending_stock: { bg: 'bg-blue-100', text: 'text-blue-700' },
  approved: { bg: 'bg-green-100', text: 'text-green-700' },
  rejected: { bg: 'bg-red-100', text: 'text-red-700' },
};

export default function SaleChangesScreen(): React.ReactElement {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<ChangeStatus | 'all'>('all');

  const { data: changes, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['sale-changes', statusFilter],
    queryFn: () =>
      saleChangeService
        .list({ status: statusFilter === 'all' ? undefined : statusFilter, limit: 100 })
        .then((r) => r.data),
  });

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 pt-3 pb-2 bg-white border-b border-gray-100">
        <View className="flex-row">
          {STATUS_FILTERS.map((f) => (
            <Pressable
              key={f.key}
              className={`mr-2 px-3 py-1.5 rounded-full ${statusFilter === f.key ? 'bg-primary-500' : 'bg-gray-100'}`}
              onPress={() => setStatusFilter(f.key)}
            >
              <Text className={`text-xs font-medium ${statusFilter === f.key ? 'text-white' : 'text-gray-600'}`}>{f.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={BRAND.primary} />
        </View>
      ) : (
        <FlatList
          data={changes || []}
          keyExtractor={(item) => item.id}
          contentContainerClassName="p-4"
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
          renderItem={({ item }: { item: SaleChangeListItem }) => {
            const colors = statusColors[item.status] || statusColors.pending;
            return (
              <Pressable
                className="bg-white rounded-lg p-4 mb-3 border border-gray-100"
                onPress={() => router.push({ pathname: '/(app)/sale-change-detail', params: { id: item.id } })}
              >
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="font-semibold text-gray-900">Venta #{item.sale_code}</Text>
                  <View className={`px-2 py-0.5 rounded-full ${colors.bg}`}>
                    <Text className={`text-xs font-medium ${colors.text}`}>{formatChangeStatus(item.status)}</Text>
                  </View>
                </View>
                <View className="flex-row items-center mb-1">
                  <View className="bg-gray-100 px-2 py-0.5 rounded mr-2">
                    <Text className="text-xs text-gray-600">{formatChangeType(item.change_type)}</Text>
                  </View>
                  <Text className="text-xs text-gray-400">{formatDateRelative(item.change_date)}</Text>
                </View>
                {item.original_product_name && (
                  <Text className="text-sm text-gray-600">
                    {item.original_product_name} {item.new_product_name ? `→ ${item.new_product_name}` : ''}
                  </Text>
                )}
                {item.price_adjustment !== 0 && (
                  <Text className={`text-sm font-medium mt-1 ${item.price_adjustment > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    Ajuste: {formatCurrency(Math.abs(item.price_adjustment))} {item.price_adjustment > 0 ? '(cobrar)' : '(devolver)'}
                  </Text>
                )}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View className="py-20 items-center">
              <Ionicons name="repeat-outline" size={48} color="#d1d5db" />
              <Text className="text-gray-400 mt-2">No hay cambios registrados</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
