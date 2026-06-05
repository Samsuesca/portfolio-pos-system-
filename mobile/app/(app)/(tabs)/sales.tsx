import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, TextInput, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { saleService } from '../../../src/services/saleService';
import { useCurrentSchoolId } from '../../../src/stores/schoolStore';
import { usePermissions } from '../../../src/hooks/usePermissions';
import { formatCurrency, formatDateRelative, formatPaymentMethod, formatSaleStatus } from '../../../src/utils/format';
import { BRAND } from '../../../src/constants/brand';
import type { SaleListItem } from '../../../src/types/api';

const PAGE_SIZE = 20;

type DateFilter = 'today' | 'week' | 'month' | 'all';

function getDateRange(filter: DateFilter): { start_date?: string; end_date?: string } {
  const now = new Date();
  const bogota = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  const fmt = (d: Date) => d.toISOString().split('T')[0];

  switch (filter) {
    case 'today':
      return { start_date: fmt(bogota), end_date: fmt(bogota) };
    case 'week': {
      const start = new Date(bogota);
      start.setDate(start.getDate() - start.getDay());
      return { start_date: fmt(start), end_date: fmt(bogota) };
    }
    case 'month': {
      const start = new Date(bogota.getFullYear(), bogota.getMonth(), 1);
      return { start_date: fmt(start), end_date: fmt(bogota) };
    }
    default:
      return {};
  }
}

function SaleCard({ item, onPress }: { item: SaleListItem; onPress: () => void }): React.ReactElement {
  const statusColors: Record<string, string> = {
    completed: 'bg-green-100 text-green-700',
    pending: 'bg-amber-100 text-amber-700',
    cancelled: 'bg-red-100 text-red-700',
  };
  const colorClass = statusColors[item.status] || 'bg-gray-100 text-gray-700';

  return (
    <Pressable
      className="bg-white rounded-xl p-4 mb-3 border border-gray-100 active:bg-gray-50"
      onPress={onPress}
    >
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1">
          <Text className="font-semibold text-gray-900">#{item.code}</Text>
          <Text className="text-sm text-gray-500">{item.client_name || 'Sin cliente'}</Text>
        </View>
        <Text className="font-bold text-gray-900">{formatCurrency(Number(item.total))}</Text>
      </View>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <View className={`px-2 py-0.5 rounded-full ${colorClass.split(' ')[0]}`}>
            <Text className={`text-xs font-medium ${colorClass.split(' ')[1]}`}>
              {formatSaleStatus(item.status)}
            </Text>
          </View>
          <Text className="text-xs text-gray-400 ml-2">
            {formatPaymentMethod(item.payment_method)}
          </Text>
        </View>
        <Text className="text-xs text-gray-400">{formatDateRelative(item.sale_date)}</Text>
      </View>
    </Pressable>
  );
}

export default function SalesScreen(): React.ReactElement {
  const router = useRouter();
  const schoolId = useCurrentSchoolId();
  const { canCreateSales } = usePermissions();
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  const dateRange = getDateRange(dateFilter);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ['sales', schoolId, search, dateFilter],
    queryFn: ({ pageParam = 0 }) =>
      saleService
        .list({
          skip: pageParam,
          limit: PAGE_SIZE,
          school_id: schoolId || undefined,
          search: search || undefined,
          ...dateRange,
        })
        .then((r) => r.data),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.has_more ? allPages.length * PAGE_SIZE : undefined,
    enabled: true,
  });

  const sales = data?.pages.flatMap((p) => p.items) ?? [];

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage]);

  const filters: { key: DateFilter; label: string }[] = [
    { key: 'all', label: 'Todas' },
    { key: 'today', label: 'Hoy' },
    { key: 'week', label: 'Semana' },
    { key: 'month', label: 'Mes' },
  ];

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 pt-3 pb-2 bg-white border-b border-gray-100">
        <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2 mb-3">
          <Ionicons name="search" size={18} color="#9ca3af" />
          <TextInput
            className="flex-1 ml-2 text-base text-gray-900"
            placeholder="Buscar por cliente o # venta"
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </Pressable>
          )}
        </View>

        <View className="flex-row">
          {filters.map((f) => (
            <Pressable
              key={f.key}
              className={`mr-2 px-3 py-1.5 rounded-full ${
                dateFilter === f.key ? 'bg-primary-500' : 'bg-gray-100'
              }`}
              onPress={() => setDateFilter(f.key)}
            >
              <Text
                className={`text-sm font-medium ${
                  dateFilter === f.key ? 'text-white' : 'text-gray-600'
                }`}
              >
                {f.label}
              </Text>
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
          data={sales}
          keyExtractor={(item) => item.id}
          contentContainerClassName="p-4"
          renderItem={({ item }) => (
            <SaleCard
              item={item}
              onPress={() => router.push({ pathname: '/(app)/sale-detail', params: { id: item.id } })}
            />
          )}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator className="py-4" color={BRAND.primary} />
            ) : null
          }
          ListEmptyComponent={
            <View className="py-20 items-center">
              <Ionicons name="receipt-outline" size={48} color="#d1d5db" />
              <Text className="text-gray-400 mt-2">No hay ventas</Text>
            </View>
          }
        />
      )}

      {canCreateSales && (
        <Pressable
          className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-primary-500 items-center justify-center shadow-lg active:bg-primary-600"
          onPress={() => router.push('/(app)/new-sale')}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}
