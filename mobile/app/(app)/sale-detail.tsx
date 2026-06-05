import { useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, Redirect } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { saleService } from '../../src/services/saleService';
import { formatCurrency, formatDate, formatPaymentMethod, formatSaleStatus } from '../../src/utils/format';
import { extractErrorMessage } from '../../src/utils/apiClient';
import { usePermissions } from '../../src/hooks/usePermissions';
import { BRAND } from '../../src/constants/brand';
import { PAYMENT_METHODS } from '../../src/constants/paymentMethods';
import type { PaymentMethod } from '../../src/types/api';

export default function SaleDetailScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) return <Redirect href="/(app)/(tabs)/sales" />;

  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [amount, setAmount] = useState('');
  const [amountReceived, setAmountReceived] = useState('');
  const [notes, setNotes] = useState('');

  const { data: sale, isLoading } = useQuery({
    queryKey: ['sale', id],
    queryFn: () => saleService.getDetail(id).then((r) => r.data),
  });

  const paymentMutation = useMutation({
    mutationFn: () => {
      const balance = Number(sale!.total) - Number(sale!.paid_amount);
      const payAmount = amount ? Number(amount) : balance;
      return saleService.addPayment(sale!.school_id, sale!.id, {
        amount: payAmount,
        payment_method: paymentMethod,
        notes: notes || undefined,
        amount_received: amountReceived ? Number(amountReceived) : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sale', id] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
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

  if (isLoading || !sale) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color={BRAND.primary} />
      </View>
    );
  }

  const balance = Number(sale.total) - Number(sale.paid_amount);
  const payAmount = amount ? Number(amount) : balance;
  const canAddPayment = balance > 0 && hasPermission('sales.add_payment') && sale.status !== 'cancelled';
  const canCreateChange = sale.items.length > 0 && hasPermission('changes.create') && sale.status !== 'cancelled';

  return (
    <>
      <ScrollView className="flex-1 bg-gray-50">
        <View className="bg-white p-4 mb-3">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-xl font-bold text-gray-900">#{sale.code}</Text>
            <View className={`px-3 py-1 rounded-full ${
              sale.status === 'completed' ? 'bg-green-100' : sale.status === 'pending' ? 'bg-amber-100' : 'bg-red-100'
            }`}>
              <Text className={`text-sm font-medium ${
                sale.status === 'completed' ? 'text-green-700' : sale.status === 'pending' ? 'text-amber-700' : 'text-red-700'
              }`}>
                {formatSaleStatus(sale.status)}
              </Text>
            </View>
          </View>
          <Text className="text-sm text-gray-500">Fecha: {formatDate(sale.sale_date)}</Text>
        </View>

        <View className="bg-white p-4 mb-3">
          <Text className="font-semibold text-gray-900 mb-3">Items</Text>
          {sale.items.map((item) => (
            <View key={item.id} className="flex-row justify-between py-2 border-b border-gray-100">
              <View className="flex-1">
                <Text className="text-gray-900">{item.quantity}x Producto</Text>
                <Text className="text-xs text-gray-400">{formatCurrency(Number(item.unit_price))} c/u</Text>
              </View>
              <Text className="font-semibold text-gray-900">{formatCurrency(Number(item.subtotal))}</Text>
            </View>
          ))}
        </View>

        <View className="bg-white p-4 mb-3">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="font-semibold text-gray-900">Pagos</Text>
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
          {sale.payments.map((payment) => (
            <View key={payment.id} className="flex-row justify-between py-2 border-b border-gray-100">
              <Text className="text-gray-600">{formatPaymentMethod(payment.payment_method)}</Text>
              <Text className="font-semibold text-gray-900">{formatCurrency(Number(payment.amount))}</Text>
            </View>
          ))}
          {sale.payments.length === 0 && (
            <Text className="text-gray-400 text-sm">Sin pagos registrados</Text>
          )}
        </View>

        {canCreateChange && (
          <View className="px-4 mb-3">
            <Pressable
              className="flex-row items-center justify-center border border-amber-500 rounded-lg py-3"
              onPress={() => router.push({ pathname: '/(app)/new-sale-change', params: { saleId: sale.id } })}
            >
              <Ionicons name="repeat-outline" size={18} color="#d97706" />
              <Text className="text-amber-600 font-semibold ml-2">Cambio / Devolucion</Text>
            </Pressable>
          </View>
        )}

        <View className="bg-white p-4 mb-6">
          <View className="flex-row justify-between py-2">
            <Text className="text-gray-600">Total</Text>
            <Text className="font-bold text-lg text-gray-900">{formatCurrency(Number(sale.total))}</Text>
          </View>
          <View className="flex-row justify-between py-2">
            <Text className="text-gray-600">Pagado</Text>
            <Text className="font-semibold text-green-600">{formatCurrency(Number(sale.paid_amount))}</Text>
          </View>
          {balance > 0 && (
            <View className="flex-row justify-between py-2">
              <Text className="text-gray-600">Saldo pendiente</Text>
              <Text className="font-semibold text-red-600">{formatCurrency(balance)}</Text>
            </View>
          )}
        </View>
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
                  className={`mr-2 mb-2 px-4 py-2.5 rounded-lg flex-row items-center ${paymentMethod === m.key ? 'bg-primary-500' : 'bg-gray-100'}`}
                  onPress={() => setPaymentMethod(m.key)}
                >
                  <Ionicons name={m.icon} size={16} color={paymentMethod === m.key ? '#fff' : '#6b7280'} />
                  <Text className={`ml-1.5 text-sm font-medium ${paymentMethod === m.key ? 'text-white' : 'text-gray-600'}`}>{m.label}</Text>
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

            {paymentMethod === 'CASH' && (
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

            {paymentMethod === 'CREDIT' && (
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
