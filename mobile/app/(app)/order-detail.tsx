import { useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, Redirect } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { orderService } from '../../src/services/orderService';
import { formatCurrency, formatDate, formatOrderStatus } from '../../src/utils/format';
import { extractErrorMessage } from '../../src/utils/apiClient';
import { usePermissions } from '../../src/hooks/usePermissions';
import { BRAND } from '../../src/constants/brand';
import { PAYMENT_METHODS } from '../../src/constants/paymentMethods';

export default function OrderDetailScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) return <Redirect href="/(app)/(tabs)/home" />;

  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amount, setAmount] = useState('');
  const [amountReceived, setAmountReceived] = useState('');
  const [notes, setNotes] = useState('');

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => orderService.getDetail(id).then((r) => r.data),
  });

  const paymentMutation = useMutation({
    mutationFn: () => {
      const bal = Number(order!.balance);
      const payAmount = amount ? Number(amount) : bal;
      return orderService.addPayment(order!.school_id, order!.id, {
        amount: payAmount,
        payment_method: paymentMethod,
        notes: notes || undefined,
        amount_received: amountReceived ? Number(amountReceived) : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setShowPaymentModal(false);
      setAmount('');
      setAmountReceived('');
      setNotes('');
      Toast.show({ type: 'success', text1: 'Pago registrado exitosamente' });
    },
    onError: (err) => {
      Toast.show({ type: 'error', text1: 'Error', text2: extractErrorMessage(err) });
    },
  });

  if (isLoading || !order) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color={BRAND.primary} />
      </View>
    );
  }

  const balance = Number(order.balance);
  const payAmount = amount ? Number(amount) : balance;
  const canAddPayment = balance > 0 && hasPermission('orders.edit') && order.status !== 'cancelled';

  return (
    <>
      <ScrollView className="flex-1 bg-gray-50">
        <View className="bg-white p-4 mb-3">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-xl font-bold text-gray-900">#{order.code}</Text>
            <View className={`px-3 py-1 rounded-full ${
              order.status === 'delivered' ? 'bg-green-100' : order.status === 'ready' ? 'bg-blue-100' : 'bg-amber-100'
            }`}>
              <Text className={`text-sm font-medium ${
                order.status === 'delivered' ? 'text-green-700' : order.status === 'ready' ? 'text-blue-700' : 'text-amber-700'
              }`}>
                {formatOrderStatus(order.status)}
              </Text>
            </View>
          </View>
          {order.delivery_date && (
            <Text className="text-sm text-gray-500">Entrega: {formatDate(order.delivery_date)}</Text>
          )}
        </View>

        <View className="bg-white p-4 mb-3">
          <Text className="font-semibold text-gray-900 mb-2">Cliente</Text>
          <Text className="text-gray-700">{order.client_name}</Text>
          {order.client_phone && (
            <View className="flex-row items-center mt-1">
              <Ionicons name="call-outline" size={14} color="#6b7280" />
              <Text className="text-sm text-gray-500 ml-1">{order.client_phone}</Text>
            </View>
          )}
          {order.student_name && (
            <Text className="text-sm text-gray-500 mt-1">Estudiante: {order.student_name}</Text>
          )}
        </View>

        <View className="bg-white p-4 mb-3">
          <Text className="font-semibold text-gray-900 mb-3">Items</Text>
          {order.items.map((item) => (
            <View key={item.id} className="flex-row justify-between py-2 border-b border-gray-100">
              <View className="flex-1">
                <Text className="text-gray-900">{item.quantity}x {item.garment_type_name}</Text>
                <Text className="text-xs text-gray-400">
                  {[item.size, item.color, item.gender].filter(Boolean).join(' | ')}
                </Text>
                <View className={`px-2 py-0.5 rounded-full self-start mt-1 ${item.item_status === 'DELIVERED' ? 'bg-green-100' : 'bg-amber-100'}`}>
                  <Text className={`text-xs ${item.item_status === 'DELIVERED' ? 'text-green-600' : 'text-amber-600'}`}>{item.item_status}</Text>
                </View>
              </View>
              <Text className="font-semibold text-gray-900">{formatCurrency(Number(item.subtotal))}</Text>
            </View>
          ))}
        </View>

        <View className="bg-white p-4 mb-3">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="font-semibold text-gray-900">Resumen</Text>
            {canAddPayment && (
              <Pressable
                className="flex-row items-center bg-primary-500 px-3 py-1.5 rounded-lg"
                onPress={() => setShowPaymentModal(true)}
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text className="text-white text-sm font-medium ml-1">Registrar Pago</Text>
              </Pressable>
            )}
          </View>
          <View className="flex-row justify-between py-2">
            <Text className="text-gray-600">Total</Text>
            <Text className="font-bold text-lg text-gray-900">{formatCurrency(Number(order.total))}</Text>
          </View>
          <View className="flex-row justify-between py-2">
            <Text className="text-gray-600">Pagado</Text>
            <Text className="font-semibold text-green-600">{formatCurrency(Number(order.paid_amount))}</Text>
          </View>
          {balance > 0 && (
            <View className="flex-row justify-between py-2">
              <Text className="text-gray-600">Saldo pendiente</Text>
              <Text className="font-semibold text-red-600">{formatCurrency(balance)}</Text>
            </View>
          )}
        </View>

        {order.notes && (
          <View className="bg-white p-4 mb-6">
            <Text className="font-semibold text-gray-900 mb-2">Notas</Text>
            <Text className="text-gray-600">{order.notes}</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={showPaymentModal} animationType="slide" transparent>
        <KeyboardAvoidingView className="flex-1 justify-end" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable className="flex-1" onPress={() => setShowPaymentModal(false)} />
          <View className="bg-white rounded-t-2xl px-5 pt-5 pb-8">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-bold text-gray-900">Registrar Pago</Text>
              <Pressable onPress={() => setShowPaymentModal(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </Pressable>
            </View>

            <View className="bg-amber-50 rounded-lg p-3 mb-4">
              <Text className="text-amber-700 text-sm font-medium text-center">Saldo pendiente: {formatCurrency(balance)}</Text>
            </View>

            <Text className="text-sm font-semibold text-gray-600 mb-2">Metodo de pago</Text>
            <View className="flex-row flex-wrap mb-3">
              {PAYMENT_METHODS.map((m) => (
                <Pressable
                  key={m.key}
                  className={`mr-2 mb-2 px-4 py-2.5 rounded-lg flex-row items-center ${paymentMethod === m.value ? 'bg-primary-500' : 'bg-gray-100'}`}
                  onPress={() => setPaymentMethod(m.value)}
                >
                  <Ionicons name={m.icon} size={16} color={paymentMethod === m.value ? '#fff' : '#6b7280'} />
                  <Text className={`ml-1.5 text-sm font-medium ${paymentMethod === m.value ? 'text-white' : 'text-gray-600'}`}>{m.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text className="text-sm font-semibold text-gray-600 mb-2">Monto</Text>
            <View className="flex-row mb-3">
              <TextInput
                className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-gray-50"
                placeholder={formatCurrency(balance)}
                placeholderTextColor="#9ca3af"
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
              />
              <Pressable className="ml-2 bg-gray-100 rounded-lg px-4 justify-center" onPress={() => setAmount(String(balance))}>
                <Text className="text-gray-600 font-medium text-sm">Todo</Text>
              </Pressable>
            </View>

            {paymentMethod === 'cash' && (
              <>
                <Text className="text-sm font-semibold text-gray-600 mb-2">Recibido</Text>
                <TextInput
                  className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-gray-50 mb-2"
                  placeholder="Monto recibido para calcular cambio"
                  placeholderTextColor="#9ca3af"
                  value={amountReceived}
                  onChangeText={setAmountReceived}
                  keyboardType="numeric"
                />
                {amountReceived && Number(amountReceived) > payAmount && (
                  <Text className="text-green-600 text-sm font-medium mb-2">Cambio: {formatCurrency(Number(amountReceived) - payAmount)}</Text>
                )}
              </>
            )}

            {paymentMethod === 'credit' && (
              <View className="bg-blue-50 rounded-lg p-3 mb-3">
                <Text className="text-blue-700 text-xs">Se creara una Cuenta por Cobrar automaticamente.</Text>
              </View>
            )}

            <TextInput
              className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-gray-50 mb-4"
              placeholder="Notas (opcional)"
              placeholderTextColor="#9ca3af"
              value={notes}
              onChangeText={setNotes}
            />

            <Pressable
              className={`rounded-lg py-4 items-center ${paymentMutation.isPending || payAmount <= 0 || payAmount > balance ? 'bg-gray-300' : 'bg-primary-500 active:bg-primary-600'}`}
              onPress={() => paymentMutation.mutate()}
              disabled={paymentMutation.isPending || payAmount <= 0 || payAmount > balance}
            >
              {paymentMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-semibold text-base">Registrar {formatCurrency(payAmount)}</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
