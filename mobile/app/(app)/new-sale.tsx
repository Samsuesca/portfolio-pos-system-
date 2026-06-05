import { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, FlatList,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useSaleDraftStore, type CartItem } from '../../src/stores/saleDraftStore';
import { BRAND } from '../../src/constants/brand';
import { PAYMENT_METHODS } from '../../src/constants/paymentMethods';
import { useCurrentSchoolId } from '../../src/stores/schoolStore';
import { clientService } from '../../src/services/clientService';
import { productService } from '../../src/services/productService';
import { saleService } from '../../src/services/saleService';
import { extractErrorMessage } from '../../src/utils/apiClient';
import { formatCurrency } from '../../src/utils/format';
import type { PaymentMethod, ProductListItem, ClientListItem, SaleCreate } from '../../src/types/api';

type Step = 'client' | 'items' | 'payment' | 'confirm';

function ClientStep({ onNext }: { onNext: () => void }): React.ReactElement {
  const [search, setSearch] = useState('');
  const { clientId, clientName, setClient } = useSaleDraftStore();
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
            className={`bg-white rounded-lg p-3 mb-2 border ${
              clientId === item.id ? 'border-primary-500' : 'border-gray-100'
            }`}
            onPress={() => {
              setClient(item.id, item.name);
            }}
          >
            <Text className="font-medium text-gray-900">{item.name}</Text>
            <Text className="text-xs text-gray-400">{item.phone || item.code}</Text>
          </Pressable>
        )}
      />

      <Pressable
        className="bg-primary-500 rounded-lg py-3.5 items-center mt-auto active:bg-primary-600"
        onPress={onNext}
      >
        <Text className="text-white font-semibold">
          {clientId ? 'Continuar' : 'Continuar sin cliente'}
        </Text>
      </Pressable>
    </View>
  );
}

function ItemsStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }): React.ReactElement {
  const schoolId = useCurrentSchoolId();
  const [search, setSearch] = useState('');
  const { items, addItem, updateItemQuantity, removeItem, getTotal } = useSaleDraftStore();

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', schoolId, search],
    queryFn: () =>
      productService
        .list({ school_id: schoolId || undefined, with_stock: true, search: search || undefined, limit: 100 })
        .then((r) => r.data),
    enabled: !!schoolId,
  });

  const total = getTotal();

  return (
    <View className="flex-1">
      <Text className="text-lg font-bold text-gray-900 mb-1">2. Agregar Productos</Text>
      {total > 0 && (
        <Text className="text-sm text-primary-500 font-semibold mb-3">
          Subtotal: {formatCurrency(total)} ({items.length} items)
        </Text>
      )}

      <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2 mb-3">
        <Ionicons name="search" size={18} color="#9ca3af" />
        <TextInput
          className="flex-1 ml-2 text-base text-gray-900"
          placeholder="Buscar producto..."
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {items.length > 0 && (
        <View className="bg-primary-50 rounded-xl p-3 mb-3">
          <Text className="text-xs font-semibold text-primary-700 mb-2">EN CARRITO</Text>
          {items.map((item: CartItem) => (
            <View key={item.product_id} className="flex-row items-center justify-between py-1.5">
              <View className="flex-1">
                <Text className="text-sm text-gray-900">{item.name} {item.size || ''}</Text>
                <Text className="text-xs text-gray-500">{formatCurrency(item.unit_price)} c/u</Text>
              </View>
              <View className="flex-row items-center">
                <Pressable
                  className="w-7 h-7 rounded-full bg-white items-center justify-center"
                  onPress={() => updateItemQuantity(item.product_id, item.quantity - 1)}
                >
                  <Ionicons name="remove" size={16} color={BRAND.primary} />
                </Pressable>
                <Text className="mx-2 font-semibold text-gray-900 w-6 text-center">{item.quantity}</Text>
                <Pressable
                  className="w-7 h-7 rounded-full bg-white items-center justify-center"
                  onPress={() => updateItemQuantity(item.product_id, item.quantity + 1)}
                >
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
            const inCart = items.find((i: CartItem) => i.product_id === item.id);
            const stockNum = item.stock != null ? Number(item.stock) : null;
            return (
              <Pressable
                className={`bg-white rounded-lg p-3 mb-2 border flex-row items-center ${
                  inCart ? 'border-primary-300 bg-primary-50' : 'border-gray-100'
                }`}
                onPress={() =>
                  addItem({
                    id: item.id,
                    name: item.name,
                    size: item.size,
                    price: Number(item.price),
                    stock: stockNum,
                  })
                }
              >
                <View className="flex-1">
                  <Text className="font-medium text-gray-900">{item.name}</Text>
                  <View className="flex-row items-center mt-0.5">
                    {item.size && (
                      <Text className="text-xs text-gray-400 mr-2">Talla: {item.size}</Text>
                    )}
                    <Text className={`text-xs font-medium ${
                      stockNum === 0 ? 'text-red-500' : stockNum != null && stockNum <= 5 ? 'text-amber-500' : 'text-green-500'
                    }`}>
                      Stock: {stockNum ?? '?'}
                    </Text>
                  </View>
                </View>
                <Text className="font-semibold text-gray-900 mr-2">{formatCurrency(Number(item.price))}</Text>
                {inCart && (
                  <View className="w-6 h-6 rounded-full bg-primary-500 items-center justify-center">
                    <Text className="text-white text-xs font-bold">{inCart.quantity}</Text>
                  </View>
                )}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View className="py-10 items-center">
              <Text className="text-gray-400">No se encontraron productos</Text>
            </View>
          }
        />
      )}

      <View className="flex-row mt-3">
        <Pressable
          className="flex-1 mr-2 border border-gray-300 rounded-lg py-3.5 items-center"
          onPress={onBack}
        >
          <Text className="text-gray-700 font-semibold">Atras</Text>
        </Pressable>
        <Pressable
          className={`flex-1 rounded-lg py-3.5 items-center ${
            items.length === 0 ? 'bg-gray-300' : 'bg-primary-500 active:bg-primary-600'
          }`}
          onPress={onNext}
          disabled={items.length === 0}
        >
          <Text className="text-white font-semibold">Continuar</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PaymentStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }): React.ReactElement {
  const { getTotal, addPayment, payments, removePayment, getPaidAmount } = useSaleDraftStore();
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [amount, setAmount] = useState('');
  const [amountReceived, setAmountReceived] = useState('');

  const total = getTotal();
  const paid = getPaidAmount();
  const remaining = total - paid;

  const handleAddPayment = () => {
    const payAmount = amount ? Number(amount) : remaining;
    if (payAmount <= 0) return;
    addPayment({
      amount: payAmount,
      payment_method: method,
      amount_received: method === 'CASH' && amountReceived ? Number(amountReceived) : null,
    });
    setAmount('');
    setAmountReceived('');
  };

  return (
    <View className="flex-1">
      <Text className="text-lg font-bold text-gray-900 mb-1">3. Registrar Pago</Text>
      <Text className="text-sm text-gray-500 mb-4">
        Total: {formatCurrency(total)} | Pagado: {formatCurrency(paid)} | Saldo: {formatCurrency(remaining)}
      </Text>

      {payments.length > 0 && (
        <View className="bg-green-50 rounded-xl p-3 mb-3">
          <Text className="text-xs font-semibold text-green-700 mb-2">PAGOS REGISTRADOS</Text>
          {payments.map((p, i) => (
            <View key={i} className="flex-row justify-between items-center py-1">
              <Text className="text-sm text-gray-700">
                {PAYMENT_METHODS.find((m) => m.key === p.payment_method)?.label}: {formatCurrency(Number(p.amount))}
              </Text>
              <Pressable onPress={() => removePayment(i)}>
                <Ionicons name="close-circle" size={18} color="#ef4444" />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {remaining > 0 && (
        <>
          <Text className="text-sm font-semibold text-gray-600 mb-2">Metodo de pago</Text>
          <View className="flex-row flex-wrap mb-3">
            {PAYMENT_METHODS.map((m) => (
              <Pressable
                key={m.key}
                className={`mr-2 mb-2 px-4 py-2.5 rounded-lg flex-row items-center ${
                  method === m.key ? 'bg-primary-500' : 'bg-gray-100'
                }`}
                onPress={() => setMethod(m.key)}
              >
                <Ionicons name={m.icon} size={16} color={method === m.key ? '#fff' : '#6b7280'} />
                <Text className={`ml-1.5 text-sm font-medium ${
                  method === m.key ? 'text-white' : 'text-gray-600'
                }`}>
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text className="text-sm font-semibold text-gray-600 mb-2">Monto</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-gray-50 mb-3"
            placeholder={`${remaining} (saldo restante)`}
            placeholderTextColor="#9ca3af"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
          />

          {method === 'CASH' && (
            <>
              <Text className="text-sm font-semibold text-gray-600 mb-2">Recibido (opcional)</Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-gray-50 mb-2"
                placeholder="Monto recibido para calcular cambio"
                placeholderTextColor="#9ca3af"
                value={amountReceived}
                onChangeText={setAmountReceived}
                keyboardType="numeric"
              />
              {amountReceived && Number(amountReceived) > (amount ? Number(amount) : remaining) && (
                <Text className="text-green-600 text-sm font-medium mb-2">
                  Cambio: {formatCurrency(Number(amountReceived) - (amount ? Number(amount) : remaining))}
                </Text>
              )}
            </>
          )}

          <Pressable
            className="border border-primary-500 rounded-lg py-3 items-center mb-3"
            onPress={handleAddPayment}
          >
            <Text className="text-primary-500 font-semibold">Agregar pago</Text>
          </Pressable>
        </>
      )}

      {remaining <= 0 && remaining !== total && (
        <View className="bg-green-50 rounded-xl p-4 items-center mb-3">
          <Ionicons name="checkmark-circle" size={32} color="#16a34a" />
          <Text className="text-green-700 font-semibold mt-1">Pago completo</Text>
        </View>
      )}

      <View className="flex-row mt-auto">
        <Pressable
          className="flex-1 mr-2 border border-gray-300 rounded-lg py-3.5 items-center"
          onPress={onBack}
        >
          <Text className="text-gray-700 font-semibold">Atras</Text>
        </Pressable>
        <Pressable
          className="flex-1 bg-primary-500 rounded-lg py-3.5 items-center active:bg-primary-600"
          onPress={onNext}
        >
          <Text className="text-white font-semibold">
            {remaining > 0 && payments.length === 0 ? 'Venta a credito' : 'Confirmar'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function NewSaleScreen(): React.ReactElement {
  const router = useRouter();
  const schoolId = useCurrentSchoolId();
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>('client');
  const draft = useSaleDraftStore();

  const createMutation = useMutation({
    mutationFn: (data: SaleCreate) => saleService.create(schoolId!, data),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Venta creada exitosamente' });
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      draft.clear();
      router.back();
    },
    onError: (error) => {
      Toast.show({ type: 'error', text1: 'Error al crear venta', text2: extractErrorMessage(error) });
    },
  });

  const handleConfirm = () => {
    if (!schoolId) {
      Alert.alert('Error', 'Selecciona un colegio primero');
      return;
    }

    const payload: SaleCreate = {
      client_id: draft.clientId,
      items: draft.items.map((i) => ({
        product_id: i.product_id,
        quantity: i.quantity,
      })),
      source: 'desktop_app',
      payments: draft.payments.length > 0 ? draft.payments : undefined,
      payment_method: draft.payments.length === 1 ? draft.payments[0].payment_method : undefined,
    };

    createMutation.mutate(payload);
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-row px-4 pt-3 pb-2 bg-white border-b border-gray-100">
        {(['client', 'items', 'payment', 'confirm'] as Step[]).map((s, i) => (
          <View key={s} className="flex-1 flex-row items-center">
            <View className={`w-6 h-6 rounded-full items-center justify-center ${
              step === s ? 'bg-primary-500' : i < ['client', 'items', 'payment', 'confirm'].indexOf(step) ? 'bg-green-500' : 'bg-gray-300'
            }`}>
              <Text className="text-white text-xs font-bold">{i + 1}</Text>
            </View>
            {i < 3 && <View className="flex-1 h-0.5 bg-gray-200 mx-1" />}
          </View>
        ))}
      </View>

      <View className="flex-1 p-4">
        {step === 'client' && <ClientStep onNext={() => setStep('items')} />}
        {step === 'items' && <ItemsStep onNext={() => setStep('payment')} onBack={() => setStep('client')} />}
        {step === 'payment' && <PaymentStep onNext={() => setStep('confirm')} onBack={() => setStep('items')} />}
        {step === 'confirm' && (
          <View className="flex-1">
            <Text className="text-lg font-bold text-gray-900 mb-4">4. Confirmar Venta</Text>

            <View className="bg-white rounded-xl p-4 mb-3">
              <Text className="text-sm text-gray-500">Cliente</Text>
              <Text className="font-semibold text-gray-900">{draft.clientName || 'Sin cliente'}</Text>
            </View>

            <View className="bg-white rounded-xl p-4 mb-3">
              <Text className="text-sm text-gray-500 mb-2">Items ({draft.items.length})</Text>
              {draft.items.map((item: CartItem) => (
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

            <View className="bg-white rounded-xl p-4 mb-4">
              <Text className="text-sm text-gray-500 mb-2">Pagos</Text>
              {draft.payments.length > 0 ? (
                draft.payments.map((p, i) => (
                  <View key={i} className="flex-row justify-between py-1">
                    <Text className="text-gray-700">
                      {PAYMENT_METHODS.find((m) => m.key === p.payment_method)?.label}
                    </Text>
                    <Text className="font-medium text-gray-900">{formatCurrency(Number(p.amount))}</Text>
                  </View>
                ))
              ) : (
                <Text className="text-amber-600 text-sm">Venta a credito (sin pagos)</Text>
              )}
            </View>

            <View className="flex-row mt-auto">
              <Pressable
                className="flex-1 mr-2 border border-gray-300 rounded-lg py-3.5 items-center"
                onPress={() => setStep('payment')}
              >
                <Text className="text-gray-700 font-semibold">Atras</Text>
              </Pressable>
              <Pressable
                className={`flex-1 rounded-lg py-3.5 items-center ${
                  createMutation.isPending ? 'bg-gray-300' : 'bg-green-600 active:bg-green-700'
                }`}
                onPress={handleConfirm}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-semibold">Crear Venta</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
