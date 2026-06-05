import { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, FlatList,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, Redirect } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { saleService } from '../../src/services/saleService';
import { saleChangeService } from '../../src/services/saleChangeService';
import { productService } from '../../src/services/productService';
import { useCurrentSchoolId } from '../../src/stores/schoolStore';
import { extractErrorMessage } from '../../src/utils/apiClient';
import { formatCurrency } from '../../src/utils/format';
import { BRAND } from '../../src/constants/brand';
import type { ChangeType, SaleChangeCreate, SaleItem, ProductListItem } from '../../src/types/api';

const CHANGE_TYPES: { key: ChangeType; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'size_change', label: 'Cambio de talla', icon: 'resize-outline' },
  { key: 'product_change', label: 'Cambio de producto', icon: 'swap-horizontal-outline' },
  { key: 'return', label: 'Devolucion', icon: 'return-down-back-outline' },
  { key: 'defect', label: 'Defecto', icon: 'warning-outline' },
];

export default function NewSaleChangeScreen(): React.ReactElement {
  const { saleId } = useLocalSearchParams<{ saleId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const schoolId = useCurrentSchoolId();

  if (!saleId || !schoolId) return <Redirect href="/(app)/(tabs)/sales" />;

  const [selectedItem, setSelectedItem] = useState<SaleItem | null>(null);
  const [changeType, setChangeType] = useState<ChangeType | null>(null);
  const [newProductId, setNewProductId] = useState<string | null>(null);
  const [newProductName, setNewProductName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [productSearch, setProductSearch] = useState('');

  const { data: sale } = useQuery({
    queryKey: ['sale', saleId],
    queryFn: () => saleService.getDetail(saleId).then((r) => r.data),
  });

  const { data: products } = useQuery({
    queryKey: ['products-change', schoolId, productSearch],
    queryFn: () => productService.list({ school_id: schoolId, with_stock: true, search: productSearch || undefined, limit: 50 }).then((r) => r.data),
    enabled: !!changeType && changeType !== 'return',
  });

  const mutation = useMutation({
    mutationFn: (data: SaleChangeCreate) => saleChangeService.create(schoolId, saleId, data),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Cambio registrado exitosamente' });
      qc.invalidateQueries({ queryKey: ['sale', saleId] });
      qc.invalidateQueries({ queryKey: ['sale-changes'] });
      router.back();
    },
    onError: (err) => {
      Toast.show({ type: 'error', text1: 'Error', text2: extractErrorMessage(err) });
    },
  });

  const handleSubmit = () => {
    if (!selectedItem || !changeType) return;
    if (reason.trim().length < 3) {
      Toast.show({ type: 'error', text1: 'La razon debe tener al menos 3 caracteres' });
      return;
    }
    if (changeType !== 'return' && !newProductId) {
      Toast.show({ type: 'error', text1: 'Selecciona un producto nuevo' });
      return;
    }

    mutation.mutate({
      change_type: changeType,
      original_item_id: selectedItem.id,
      returned_quantity: Number(quantity) || 1,
      new_product_id: changeType !== 'return' ? newProductId : undefined,
      new_quantity: changeType !== 'return' ? (Number(quantity) || 1) : undefined,
      reason: reason.trim(),
      create_order_if_no_stock: true,
    });
  };

  const needsNewProduct = changeType && changeType !== 'return';

  return (
    <KeyboardAvoidingView className="flex-1 bg-gray-50" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled">
        <Text className="text-lg font-bold text-gray-900 mb-3">1. Seleccionar item</Text>
        {sale?.items.map((item) => (
          <Pressable
            key={item.id}
            className={`bg-white rounded-lg p-3 mb-2 border ${selectedItem?.id === item.id ? 'border-primary-500' : 'border-gray-100'}`}
            onPress={() => setSelectedItem(item)}
          >
            <View className="flex-row justify-between">
              <Text className="font-medium text-gray-900">{item.quantity}x Producto</Text>
              <Text className="font-semibold text-gray-900">{formatCurrency(Number(item.subtotal))}</Text>
            </View>
            <Text className="text-xs text-gray-400">{formatCurrency(Number(item.unit_price))} c/u</Text>
          </Pressable>
        ))}

        {selectedItem && (
          <>
            <Text className="text-lg font-bold text-gray-900 mt-4 mb-3">2. Tipo de cambio</Text>
            <View className="flex-row flex-wrap mb-3">
              {CHANGE_TYPES.map((ct) => (
                <Pressable
                  key={ct.key}
                  className={`mr-2 mb-2 px-4 py-2.5 rounded-lg flex-row items-center ${changeType === ct.key ? 'bg-primary-500' : 'bg-gray-100'}`}
                  onPress={() => { setChangeType(ct.key); setNewProductId(null); setNewProductName(''); }}
                >
                  <Ionicons name={ct.icon} size={16} color={changeType === ct.key ? '#fff' : '#6b7280'} />
                  <Text className={`ml-1.5 text-sm font-medium ${changeType === ct.key ? 'text-white' : 'text-gray-600'}`}>{ct.label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {needsNewProduct && (
          <>
            <Text className="text-lg font-bold text-gray-900 mt-2 mb-3">3. Nuevo producto</Text>
            {newProductId && (
              <View className="bg-primary-50 border border-primary-200 rounded-xl p-3 mb-3 flex-row items-center justify-between">
                <Text className="font-semibold text-primary-700">{newProductName}</Text>
                <Pressable onPress={() => { setNewProductId(null); setNewProductName(''); }}>
                  <Ionicons name="close-circle" size={22} color={BRAND.primary} />
                </Pressable>
              </View>
            )}
            <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2 mb-2">
              <Ionicons name="search" size={18} color="#9ca3af" />
              <TextInput className="flex-1 ml-2 text-base text-gray-900" placeholder="Buscar producto..." placeholderTextColor="#9ca3af" value={productSearch} onChangeText={setProductSearch} />
            </View>
            <FlatList
              data={products || []}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item }: { item: ProductListItem }) => (
                <Pressable
                  className={`bg-white rounded-lg p-3 mb-2 border ${newProductId === item.id ? 'border-primary-500' : 'border-gray-100'}`}
                  onPress={() => { setNewProductId(item.id); setNewProductName(`${item.name} ${item.size || ''}`); }}
                >
                  <Text className="font-medium text-gray-900">{item.name}</Text>
                  <Text className="text-xs text-gray-500">{[item.size, item.color].filter(Boolean).join(' | ')} - {formatCurrency(Number(item.price))}</Text>
                </Pressable>
              )}
            />
          </>
        )}

        {changeType && (
          <>
            <Text className="text-lg font-bold text-gray-900 mt-4 mb-3">{needsNewProduct ? '4' : '3'}. Detalles</Text>
            <Text className="text-sm font-medium text-gray-700 mb-1">Cantidad</Text>
            <TextInput
              className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-white mb-3"
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
              placeholder="1"
              placeholderTextColor="#9ca3af"
            />
            <Text className="text-sm font-medium text-gray-700 mb-1">Razon *</Text>
            <TextInput
              className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-white mb-4"
              value={reason}
              onChangeText={setReason}
              placeholder="Describe la razon del cambio (min 3 caracteres)"
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <Pressable
              className={`rounded-lg py-4 items-center ${
                mutation.isPending || !reason.trim() || reason.trim().length < 3 || (needsNewProduct && !newProductId)
                  ? 'bg-gray-300' : 'bg-primary-500 active:bg-primary-600'
              }`}
              onPress={handleSubmit}
              disabled={mutation.isPending || !reason.trim() || reason.trim().length < 3 || (needsNewProduct && !newProductId)}
            >
              {mutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-semibold text-base">Registrar Cambio</Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
