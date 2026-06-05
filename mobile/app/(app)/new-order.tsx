import { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, FlatList,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useOrderDraftStore, type OrderDraftItem } from '../../src/stores/orderDraftStore';
import { BRAND } from '../../src/constants/brand';
import { PAYMENT_METHODS } from '../../src/constants/paymentMethods';
import { useCurrentSchoolId } from '../../src/stores/schoolStore';
import { clientService } from '../../src/services/clientService';
import { productService } from '../../src/services/productService';
import { orderService } from '../../src/services/orderService';
import { extractErrorMessage } from '../../src/utils/apiClient';
import { formatCurrency } from '../../src/utils/format';
import type { ProductListItem, ClientListItem, OrderCreate } from '../../src/types/api';

type Step = 'client' | 'items' | 'advance' | 'confirm';
const STEPS: Step[] = ['client', 'items', 'advance', 'confirm'];

function ClientStep({ onNext }: { onNext: () => void }): React.ReactElement {
  const [search, setSearch] = useState('');
  const { clientId, clientName, setClient } = useOrderDraftStore();
  const router = useRouter();

  const { data: clients, isLoading } = useQuery({
    queryKey: ['client-search', search],
    queryFn: () => clientService.search(search, 20).then((r) => r.data),
    enabled: search.length >= 2,
  });

  return (
    <View className="flex-1">
      <Text className="text-lg font-bold text-gray-900 mb-3">1. Seleccionar Cliente</Text>

      {clientId && (
        <View className="bg-primary-50 border border-primary-200 rounded-xl p-3 mb-3 flex-row items-center justify-between">
          <View>
            <Text className="font-semibold text-primary-700">{clientName}</Text>
            <Text className="text-xs text-primary-500">Cliente seleccionado</Text>
          </View>
          <Pressable onPress={() => setClient(null, null)}>
            <Ionicons name="close-circle" size={22} color={BRAND.primary} />
          </Pressable>
        </View>
      )}

      <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2 mb-3">
        <Ionicons name="search" size={18} color="#9ca3af" />
        <TextInput
          className="flex-1 ml-2 text-base text-gray-900"
          placeholder="Buscar cliente por nombre o telefono"
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <Pressable
        className="border border-dashed border-gray-300 rounded-xl p-3 mb-3 flex-row items-center justify-center"
        onPress={() => router.push('/(app)/new-client')}
      >
        <Ionicons name="person-add-outline" size={18} color="#6b7280" />
        <Text className="text-gray-500 ml-2 font-medium">Nuevo cliente</Text>
      </Pressable>

      {isLoading && <ActivityIndicator className="py-4" color={BRAND.primary} />}

      <FlatList
        data={clients || []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }: { item: ClientListItem }) => (
          <Pressable
            className={`bg-white rounded-lg p-3 mb-2 border ${clientId === item.id ? 'border-primary-500' : 'border-gray-100'}`}
            onPress={() => setClient(item.id, item.name)}
          >
            <Text className="font-medium text-gray-900">{item.name}</Text>
            <Text className="text-xs text-gray-400">{item.phone || item.code}</Text>
          </Pressable>
        )}
      />

      <Pressable
        className={`rounded-lg py-3.5 items-center mt-auto ${!clientId ? 'bg-gray-300' : 'bg-primary-500 active:bg-primary-600'}`}
        onPress={onNext}
        disabled={!clientId}
      >
        <Text className="text-white font-semibold">Continuar</Text>
      </Pressable>
    </View>
  );
}

function ItemsStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }): React.ReactElement {
  const schoolId = useCurrentSchoolId();
  const [search, setSearch] = useState('');
  const [garmentFilter, setGarmentFilter] = useState<string | null>(null);
  const { items, addItem, updateItemQuantity, removeItem, getTotal, deliveryDate, setDeliveryDate, notes, setNotes } = useOrderDraftStore();

  const { data: garmentTypes } = useQuery({
    queryKey: ['garment-types', schoolId],
    queryFn: () => productService.listGarmentTypes({ school_id: schoolId || undefined }).then((r) => r.data),
    enabled: !!schoolId,
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', schoolId, search, garmentFilter],
    queryFn: () =>
      productService
        .list({
          school_id: schoolId || undefined,
          with_stock: true,
          search: search || undefined,
          garment_type_id: garmentFilter || undefined,
          limit: 100,
        })
        .then((r) => r.data),
    enabled: !!schoolId,
  });

  const total = getTotal();

  return (
    <View className="flex-1">
      <Text className="text-lg font-bold text-gray-900 mb-1">2. Agregar Productos</Text>
      {total > 0 && (
        <Text className="text-sm text-primary-500 font-semibold mb-2">
          Subtotal: {formatCurrency(total)} ({items.length} items)
        </Text>
      )}

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

      {garmentTypes && garmentTypes.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
          <Pressable
            className={`mr-2 px-3 py-1.5 rounded-full ${!garmentFilter ? 'bg-primary-500' : 'bg-gray-100'}`}
            onPress={() => setGarmentFilter(null)}
          >
            <Text className={`text-xs font-medium ${!garmentFilter ? 'text-white' : 'text-gray-600'}`}>Todos</Text>
          </Pressable>
          {garmentTypes.map((gt) => (
            <Pressable
              key={gt.id}
              className={`mr-2 px-3 py-1.5 rounded-full ${garmentFilter === gt.id ? 'bg-primary-500' : 'bg-gray-100'}`}
              onPress={() => setGarmentFilter(garmentFilter === gt.id ? null : gt.id)}
            >
              <Text className={`text-xs font-medium ${garmentFilter === gt.id ? 'text-white' : 'text-gray-600'}`}>{gt.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {items.length > 0 && (
        <View className="bg-primary-50 rounded-xl p-3 mb-2">
          <Text className="text-xs font-semibold text-primary-700 mb-2">EN PEDIDO</Text>
          {items.map((item: OrderDraftItem) => (
            <View key={item.product_id} className="flex-row items-center justify-between py-1.5">
              <View className="flex-1">
                <Text className="text-sm text-gray-900">{item.name} {item.size || ''}</Text>
                <Text className="text-xs text-gray-500">{formatCurrency(item.unit_price)} c/u</Text>
              </View>
              <View className="flex-row items-center">
                <Pressable className="w-7 h-7 rounded-full bg-white items-center justify-center" onPress={() => updateItemQuantity(item.product_id, item.quantity - 1)}>
                  <Ionicons name="remove" size={16} color={BRAND.primary} />
                </Pressable>
                <Text className="mx-2 font-semibold text-gray-900 w-6 text-center">{item.quantity}</Text>
                <Pressable className="w-7 h-7 rounded-full bg-white items-center justify-center" onPress={() => updateItemQuantity(item.product_id, item.quantity + 1)}>
                  <Ionicons name="add" size={16} color={BRAND.primary} />
                </Pressable>
                <Pressable className="ml-2" onPress={() => removeItem(item.product_id)}>
                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator className="py-4" color={BRAND.primary} />
      ) : (
        <FlatList
          data={products || []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }: { item: ProductListItem }) => {
            const inCart = items.find((i) => i.product_id === item.id);
            const stockNum = item.stock != null ? Number(item.stock) : null;
            return (
              <Pressable
                className={`bg-white rounded-lg p-3 mb-2 border flex-row items-center ${inCart ? 'border-primary-300 bg-primary-50' : 'border-gray-100'}`}
                onPress={() => addItem(item)}
              >
                <View className="flex-1">
                  <Text className="font-medium text-gray-900">{item.name}</Text>
                  <Text className="text-xs text-gray-500">
                    {[item.size, item.color, item.garment_type_name].filter(Boolean).join(' | ')}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="font-semibold text-gray-900">{formatCurrency(Number(item.price))}</Text>
                  {stockNum != null && (
                    <Text className={`text-xs ${stockNum <= 0 ? 'text-red-500' : stockNum <= 5 ? 'text-amber-500' : 'text-green-500'}`}>
                      {stockNum} uds
                    </Text>
                  )}
                </View>
                {inCart && (
                  <View className="ml-2 w-6 h-6 rounded-full bg-primary-500 items-center justify-center">
                    <Text className="text-white text-xs font-bold">{inCart.quantity}</Text>
                  </View>
                )}
              </Pressable>
            );
          }}
        />
      )}

      <View className="mt-2 mb-2">
        <TextInput
          className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 bg-white mb-2"
          placeholder="Fecha de entrega (YYYY-MM-DD)"
          placeholderTextColor="#9ca3af"
          value={deliveryDate || ''}
          onChangeText={(t) => setDeliveryDate(t || null)}
        />
        <TextInput
          className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 bg-white"
          placeholder="Notas del pedido (opcional)"
          placeholderTextColor="#9ca3af"
          value={notes}
          onChangeText={setNotes}
        />
      </View>

      <View className="flex-row mt-2">
        <Pressable className="flex-1 mr-2 border border-gray-300 rounded-lg py-3.5 items-center" onPress={onBack}>
          <Text className="text-gray-700 font-semibold">Atras</Text>
        </Pressable>
        <Pressable
          className={`flex-1 rounded-lg py-3.5 items-center ${items.length === 0 ? 'bg-gray-300' : 'bg-primary-500 active:bg-primary-600'}`}
          onPress={onNext}
          disabled={items.length === 0}
        >
          <Text className="text-white font-semibold">Continuar</Text>
        </Pressable>
      </View>
    </View>
  );
}

function AdvanceStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }): React.ReactElement {
  const { advanceAmount, advanceMethod, advanceReceived, setAdvance, getTotal } = useOrderDraftStore();
  const total = getTotal();
  const advNum = advanceAmount ? Number(advanceAmount) : 0;

  return (
    <View className="flex-1">
      <Text className="text-lg font-bold text-gray-900 mb-1">3. Anticipo (opcional)</Text>
      <Text className="text-sm text-gray-500 mb-4">Total del pedido: {formatCurrency(total)}</Text>

      <Text className="text-sm font-semibold text-gray-600 mb-2">Monto del anticipo</Text>
      <View className="flex-row mb-3">
        <TextInput
          className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-gray-50"
          placeholder="0 (sin anticipo)"
          placeholderTextColor="#9ca3af"
          value={advanceAmount}
          onChangeText={(v) => setAdvance(v, advanceMethod, advanceReceived)}
          keyboardType="numeric"
        />
        <Pressable className="ml-2 bg-gray-100 rounded-lg px-4 justify-center" onPress={() => setAdvance(String(total), advanceMethod, advanceReceived)}>
          <Text className="text-gray-600 font-medium text-sm">Todo</Text>
        </Pressable>
      </View>

      {advNum > 0 && (
        <>
          <Text className="text-sm font-semibold text-gray-600 mb-2">Metodo de pago</Text>
          <View className="flex-row flex-wrap mb-3">
            {PAYMENT_METHODS.map((m) => (
              <Pressable
                key={m.value}
                className={`mr-2 mb-2 px-4 py-2.5 rounded-lg flex-row items-center ${advanceMethod === m.value ? 'bg-primary-500' : 'bg-gray-100'}`}
                onPress={() => setAdvance(advanceAmount, m.value, advanceReceived)}
              >
                <Ionicons name={m.icon} size={16} color={advanceMethod === m.value ? '#fff' : '#6b7280'} />
                <Text className={`ml-1.5 text-sm font-medium ${advanceMethod === m.value ? 'text-white' : 'text-gray-600'}`}>{m.label}</Text>
              </Pressable>
            ))}
          </View>

          {advanceMethod === 'cash' && (
            <>
              <Text className="text-sm font-semibold text-gray-600 mb-2">Recibido</Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-gray-50 mb-2"
                placeholder="Monto recibido"
                placeholderTextColor="#9ca3af"
                value={advanceReceived}
                onChangeText={(v) => setAdvance(advanceAmount, advanceMethod, v)}
                keyboardType="numeric"
              />
              {advanceReceived && Number(advanceReceived) > advNum && (
                <Text className="text-green-600 text-sm font-medium mb-2">
                  Cambio: {formatCurrency(Number(advanceReceived) - advNum)}
                </Text>
              )}
            </>
          )}
        </>
      )}

      <View className="flex-row mt-auto">
        <Pressable className="flex-1 mr-2 border border-gray-300 rounded-lg py-3.5 items-center" onPress={onBack}>
          <Text className="text-gray-700 font-semibold">Atras</Text>
        </Pressable>
        <Pressable className="flex-1 bg-primary-500 rounded-lg py-3.5 items-center active:bg-primary-600" onPress={onNext}>
          <Text className="text-white font-semibold">{advNum > 0 ? 'Continuar' : 'Sin anticipo'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function NewOrderScreen(): React.ReactElement {
  const router = useRouter();
  const qc = useQueryClient();
  const schoolId = useCurrentSchoolId();
  const draft = useOrderDraftStore();
  const [step, setStep] = useState<Step>('client');

  const createMutation = useMutation({
    mutationFn: (payload: OrderCreate) => orderService.create(schoolId!, payload),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Pedido creado exitosamente' });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      draft.clear();
      router.back();
    },
    onError: (err) => {
      Toast.show({ type: 'error', text1: 'Error', text2: extractErrorMessage(err) });
    },
  });

  const handleConfirm = () => {
    if (!schoolId) {
      Alert.alert('Error', 'Selecciona un colegio primero');
      return;
    }
    if (!draft.clientId) {
      Alert.alert('Error', 'Selecciona un cliente');
      return;
    }

    const advNum = draft.advanceAmount ? Number(draft.advanceAmount) : undefined;

    const payload: OrderCreate = {
      client_id: draft.clientId,
      delivery_date: draft.deliveryDate || undefined,
      notes: draft.notes || undefined,
      items: draft.items.map((i) => ({
        product_id: i.product_id,
        garment_type_id: i.garment_type_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
      })),
      advance_payment: advNum && advNum > 0 ? advNum : undefined,
      advance_payment_method: advNum && advNum > 0 ? draft.advanceMethod : undefined,
      advance_amount_received: advNum && advNum > 0 && draft.advanceReceived ? Number(draft.advanceReceived) : undefined,
      source: 'desktop_app',
    };

    createMutation.mutate(payload);
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-gray-50" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View className="flex-row px-4 pt-3 pb-2 bg-white border-b border-gray-100">
        {STEPS.map((s, i) => (
          <View key={s} className="flex-1 flex-row items-center">
            <View className={`w-6 h-6 rounded-full items-center justify-center ${
              step === s ? 'bg-primary-500' : i < STEPS.indexOf(step) ? 'bg-green-500' : 'bg-gray-300'
            }`}>
              <Text className="text-white text-xs font-bold">{i + 1}</Text>
            </View>
            {i < 3 && <View className="flex-1 h-0.5 bg-gray-200 mx-1" />}
          </View>
        ))}
      </View>

      <View className="flex-1 p-4">
        {step === 'client' && <ClientStep onNext={() => setStep('items')} />}
        {step === 'items' && <ItemsStep onNext={() => setStep('advance')} onBack={() => setStep('client')} />}
        {step === 'advance' && <AdvanceStep onNext={() => setStep('confirm')} onBack={() => setStep('items')} />}
        {step === 'confirm' && (
          <View className="flex-1">
            <Text className="text-lg font-bold text-gray-900 mb-4">4. Confirmar Pedido</Text>

            <View className="bg-white rounded-xl p-4 mb-3">
              <Text className="text-sm text-gray-500">Cliente</Text>
              <Text className="font-semibold text-gray-900">{draft.clientName}</Text>
            </View>

            <View className="bg-white rounded-xl p-4 mb-3">
              <Text className="text-sm text-gray-500 mb-2">Items ({draft.items.length})</Text>
              {draft.items.map((item: OrderDraftItem) => (
                <View key={item.product_id} className="flex-row justify-between py-1">
                  <Text className="text-gray-700">{item.quantity}x {item.name} {item.size || ''}</Text>
                  <Text className="font-medium text-gray-900">{formatCurrency(item.unit_price * item.quantity)}</Text>
                </View>
              ))}
              <View className="border-t border-gray-200 mt-2 pt-2 flex-row justify-between">
                <Text className="font-bold text-gray-900">Total</Text>
                <Text className="font-bold text-lg text-gray-900">{formatCurrency(draft.getTotal())}</Text>
              </View>
            </View>

            {draft.deliveryDate && (
              <View className="bg-white rounded-xl p-4 mb-3">
                <Text className="text-sm text-gray-500">Fecha de entrega</Text>
                <Text className="font-semibold text-gray-900">{draft.deliveryDate}</Text>
              </View>
            )}

            {draft.advanceAmount && Number(draft.advanceAmount) > 0 && (
              <View className="bg-green-50 rounded-xl p-4 mb-3">
                <Text className="text-sm text-green-700">Anticipo</Text>
                <Text className="font-semibold text-green-800">
                  {formatCurrency(Number(draft.advanceAmount))} ({PAYMENT_METHODS.find((m) => m.value === draft.advanceMethod)?.label})
                </Text>
              </View>
            )}

            <View className="flex-row mt-auto">
              <Pressable className="flex-1 mr-2 border border-gray-300 rounded-lg py-3.5 items-center" onPress={() => setStep('advance')}>
                <Text className="text-gray-700 font-semibold">Atras</Text>
              </Pressable>
              <Pressable
                className={`flex-1 rounded-lg py-3.5 items-center ${createMutation.isPending ? 'bg-gray-300' : 'bg-green-600 active:bg-green-700'}`}
                onPress={handleConfirm}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-semibold">Crear Pedido</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
