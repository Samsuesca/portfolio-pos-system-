import { useState } from 'react';
import {
  View, Text, FlatList, TextInput, ActivityIndicator, RefreshControl, ScrollView, Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { productService } from '../../src/services/productService';
import { useCurrentSchoolId } from '../../src/stores/schoolStore';
import { BRAND } from '../../src/constants/brand';
import { formatCurrency } from '../../src/utils/format';
import type { ProductListItem } from '../../src/types/api';

function StockBadge({ stock }: { stock: number | null }): React.ReactElement {
  const num = stock != null ? Number(stock) : null;
  const color = num === null ? 'bg-gray-100 text-gray-500'
    : num === 0 ? 'bg-red-100 text-red-600'
    : num <= 5 ? 'bg-amber-100 text-amber-600'
    : 'bg-green-100 text-green-600';

  return (
    <View className={`px-2 py-0.5 rounded-full ${color.split(' ')[0]}`}>
      <Text className={`text-xs font-semibold ${color.split(' ')[1]}`}>
        {num ?? '?'}
      </Text>
    </View>
  );
}

export default function InventoryScreen(): React.ReactElement {
  const schoolId = useCurrentSchoolId();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [garmentFilter, setGarmentFilter] = useState<string | null>(null);
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const { data: garmentTypes } = useQuery({
    queryKey: ['garment-types', schoolId],
    queryFn: () => productService.listGarmentTypes({ school_id: schoolId || undefined }).then((r) => r.data),
    enabled: !!schoolId,
  });

  const { data: products, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['inventory', schoolId, search, garmentFilter],
    queryFn: () =>
      productService
        .list({
          school_id: schoolId || undefined,
          with_stock: true,
          search: search || undefined,
          garment_type_id: garmentFilter || undefined,
          limit: 200,
          active_only: true,
        })
        .then((r) => r.data),
    enabled: !!schoolId,
  });

  const filtered = lowStockOnly
    ? (products || []).filter((p) => p.stock != null && Number(p.stock) <= 5)
    : products || [];

  const grouped = filtered.reduce<Record<string, ProductListItem[]>>((acc, p) => {
    const key = p.garment_type_name || 'Sin tipo';
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  const sections = Object.entries(grouped).map(([title, data]) => ({ title, data }));

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 pt-3 pb-2 bg-white border-b border-gray-100">
        <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2 mb-2">
          <Ionicons name="search" size={18} color="#9ca3af" />
          <TextInput
            className="flex-1 ml-2 text-base text-gray-900"
            placeholder="Buscar producto..."
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Pressable
            className={`mr-2 px-3 py-1.5 rounded-full ${!garmentFilter ? 'bg-primary-500' : 'bg-gray-100'}`}
            onPress={() => setGarmentFilter(null)}
          >
            <Text className={`text-xs font-medium ${!garmentFilter ? 'text-white' : 'text-gray-600'}`}>Todos</Text>
          </Pressable>
          {(garmentTypes || []).map((gt) => (
            <Pressable
              key={gt.id}
              className={`mr-2 px-3 py-1.5 rounded-full ${garmentFilter === gt.id ? 'bg-primary-500' : 'bg-gray-100'}`}
              onPress={() => setGarmentFilter(garmentFilter === gt.id ? null : gt.id)}
            >
              <Text className={`text-xs font-medium ${garmentFilter === gt.id ? 'text-white' : 'text-gray-600'}`}>{gt.name}</Text>
            </Pressable>
          ))}
          <Pressable
            className={`px-3 py-1.5 rounded-full ${lowStockOnly ? 'bg-red-500' : 'bg-gray-100'}`}
            onPress={() => setLowStockOnly(!lowStockOnly)}
          >
            <Text className={`text-xs font-medium ${lowStockOnly ? 'text-white' : 'text-gray-600'}`}>Bajo stock</Text>
          </Pressable>
        </ScrollView>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={BRAND.primary} />
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(item) => item.title}
          contentContainerClassName="p-4"
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
          renderItem={({ item: section }) => (
            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">{section.title}</Text>
              {section.data.map((product) => (
                <View key={product.id} className="bg-white rounded-lg p-3 mb-2 border border-gray-100">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="font-medium text-gray-900">{product.name}</Text>
                      <View className="flex-row items-center mt-1">
                        {product.size && <Text className="text-xs text-gray-400 mr-3">Talla: {product.size}</Text>}
                        {product.color && <Text className="text-xs text-gray-400 mr-3">{product.color}</Text>}
                        <Text className="text-xs text-gray-400">{formatCurrency(Number(product.price))}</Text>
                      </View>
                      {product.pending_orders_qty > 0 && (
                        <Text className="text-xs text-blue-500 mt-0.5">{product.pending_orders_qty} encargados</Text>
                      )}
                    </View>
                    <StockBadge stock={product.stock} />
                  </View>
                </View>
              ))}
            </View>
          )}
          ListEmptyComponent={
            <View className="py-20 items-center">
              <Ionicons name="cube-outline" size={48} color="#d1d5db" />
              <Text className="text-gray-400 mt-2">{lowStockOnly ? 'No hay productos con bajo stock' : 'No hay productos'}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
