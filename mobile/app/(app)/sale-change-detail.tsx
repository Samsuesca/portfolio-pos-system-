import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Redirect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { saleChangeService } from '../../src/services/saleChangeService';
import { formatCurrency, formatDate, formatChangeType, formatChangeStatus } from '../../src/utils/format';
import { BRAND } from '../../src/constants/brand';

const statusColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-amber-100', text: 'text-amber-700' },
  pending_stock: { bg: 'bg-blue-100', text: 'text-blue-700' },
  approved: { bg: 'bg-green-100', text: 'text-green-700' },
  rejected: { bg: 'bg-red-100', text: 'text-red-700' },
};

export default function SaleChangeDetailScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) return <Redirect href="/(app)/sale-changes" />;

  const { data: change, isLoading } = useQuery({
    queryKey: ['sale-change', id],
    queryFn: () => saleChangeService.getDetail(id).then((r) => r.data),
  });

  if (isLoading || !change) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color={BRAND.primary} />
      </View>
    );
  }

  const colors = statusColors[change.status] || statusColors.pending;

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="bg-white p-4 mb-3">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-xl font-bold text-gray-900">Venta #{change.sale_code}</Text>
          <View className={`px-3 py-1 rounded-full ${colors.bg}`}>
            <Text className={`text-sm font-medium ${colors.text}`}>{formatChangeStatus(change.status)}</Text>
          </View>
        </View>
        <View className="bg-gray-100 px-3 py-1 rounded-full self-start">
          <Text className="text-sm text-gray-600">{formatChangeType(change.change_type)}</Text>
        </View>
        <Text className="text-sm text-gray-500 mt-2">Fecha: {formatDate(change.change_date)}</Text>
      </View>

      <View className="bg-white p-4 mb-3">
        <Text className="font-semibold text-gray-900 mb-3">Productos</Text>
        <View className="flex-row justify-between py-2 border-b border-gray-100">
          <Text className="text-gray-600">Original</Text>
          <View className="items-end">
            <Text className="font-medium text-gray-900">{change.original_product_name || 'N/A'}</Text>
            {change.original_unit_price != null && (
              <Text className="text-xs text-gray-400">{formatCurrency(change.original_unit_price)}</Text>
            )}
          </View>
        </View>
        {change.new_product_name && (
          <View className="flex-row justify-between py-2 border-b border-gray-100">
            <Text className="text-gray-600">Nuevo</Text>
            <View className="items-end">
              <Text className="font-medium text-gray-900">{change.new_product_name}</Text>
              {change.new_unit_price != null && (
                <Text className="text-xs text-gray-400">{formatCurrency(change.new_unit_price)}</Text>
              )}
            </View>
          </View>
        )}
        <View className="flex-row justify-between py-2">
          <Text className="text-gray-600">Cantidad</Text>
          <Text className="font-medium text-gray-900">{change.returned_quantity} → {change.new_quantity}</Text>
        </View>
      </View>

      {change.price_adjustment !== 0 && (
        <View className={`p-4 mb-3 ${change.price_adjustment > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
          <Text className={`text-sm font-medium ${change.price_adjustment > 0 ? 'text-red-700' : 'text-green-700'}`}>
            Ajuste de precio: {formatCurrency(Math.abs(change.price_adjustment))} {change.price_adjustment > 0 ? '(cobrar al cliente)' : '(devolver al cliente)'}
          </Text>
        </View>
      )}

      <View className="bg-white p-4 mb-3">
        <Text className="font-semibold text-gray-900 mb-2">Razon</Text>
        <Text className="text-gray-600">{change.reason}</Text>
      </View>

      {change.rejection_reason && (
        <View className="bg-red-50 p-4 mb-3">
          <Text className="font-semibold text-red-700 mb-1">Razon del rechazo</Text>
          <Text className="text-red-600">{change.rejection_reason}</Text>
        </View>
      )}

      <View className="bg-white p-4 mb-6">
        <Text className="font-semibold text-gray-900 mb-3">Info</Text>
        {change.client_name && (
          <View className="flex-row justify-between py-1">
            <Text className="text-gray-600">Cliente</Text>
            <Text className="text-gray-900">{change.client_name}</Text>
          </View>
        )}
        {change.school_name && (
          <View className="flex-row justify-between py-1">
            <Text className="text-gray-600">Colegio</Text>
            <Text className="text-gray-900">{change.school_name}</Text>
          </View>
        )}
        {change.created_by_name && (
          <View className="flex-row justify-between py-1">
            <Text className="text-gray-600">Creado por</Text>
            <Text className="text-gray-900">{change.created_by_name}</Text>
          </View>
        )}
        {change.approved_by_name && (
          <View className="flex-row justify-between py-1">
            <Text className="text-gray-600">Aprobado por</Text>
            <Text className="text-gray-900">{change.approved_by_name}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
