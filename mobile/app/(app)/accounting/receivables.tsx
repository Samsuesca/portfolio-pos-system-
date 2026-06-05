import { useState } from 'react';
import {
  View, Text, FlatList, Pressable, TextInput, ActivityIndicator,
  RefreshControl, Modal,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { accountingService } from '../../../src/services/accountingService';
import { usePermissions } from '../../../src/hooks/usePermissions';
import { BRAND } from '../../../src/constants/brand';
import { extractErrorMessage } from '../../../src/utils/apiClient';
import { formatCurrency, formatDate } from '../../../src/utils/format';
import type { ReceivableListItem, ReceivablePayment, AccPaymentMethod } from '../../../src/types/api';

type FilterStatus = 'pending' | 'paid' | 'all';

const ACC_PAYMENT_METHODS: { key: AccPaymentMethod; label: string }[] = [
  { key: 'cash', label: 'Efectivo' },
  { key: 'nequi', label: 'Nequi' },
  { key: 'transfer', label: 'Transferencia' },
  { key: 'card', label: 'Tarjeta' },
];

function ReceivableCard({ item, onPay, showPayButton = true }: {
  item: ReceivableListItem;
  onPay: () => void;
  showPayButton?: boolean;
}): React.ReactElement {
  return (
    <View className="bg-white rounded-xl p-4 mb-3 border border-gray-100">
      <View className="flex-row justify-between items-start mb-1">
        <View className="flex-1 mr-2">
          <Text className="font-semibold text-gray-900">{item.description}</Text>
          {item.client_name && (
            <Text className="text-xs text-gray-400 mt-0.5">{item.client_name}</Text>
          )}
        </View>
        <Text className="font-bold text-gray-900">{formatCurrency(Number(item.amount))}</Text>
      </View>

      <View className="flex-row items-center justify-between mt-2">
        <View className="flex-row items-center">
          {item.is_paid ? (
            <View className="px-2 py-0.5 rounded-full bg-green-100">
              <Text className="text-xs font-medium text-green-700">Cobrado</Text>
            </View>
          ) : (
            <View className="px-2 py-0.5 rounded-full bg-amber-100">
              <Text className="text-xs font-medium text-amber-700">
                Pendiente {formatCurrency(Number(item.balance))}
              </Text>
            </View>
          )}
          {item.is_overdue && !item.is_paid && (
            <View className="ml-2 px-2 py-0.5 rounded-full bg-red-100">
              <Text className="text-xs font-medium text-red-600">Vencido</Text>
            </View>
          )}
        </View>
        <Text className="text-xs text-gray-400">{formatDate(item.invoice_date)}</Text>
      </View>

      {item.due_date && !item.is_paid && (
        <Text className="text-xs text-gray-400 mt-1">
          Vence: {formatDate(item.due_date)}
        </Text>
      )}

      {!item.is_paid && showPayButton && (
        <Pressable
          className="bg-green-600 rounded-lg py-2 mt-3 items-center active:bg-green-700"
          onPress={onPay}
        >
          <Text className="text-white font-semibold text-sm">Registrar Cobro</Text>
        </Pressable>
      )}
    </View>
  );
}

function PayReceivableModal({ receivable, visible, onClose }: {
  receivable: ReceivableListItem | null;
  visible: boolean;
  onClose: () => void;
}): React.ReactElement {
  const qc = useQueryClient();
  const [method, setMethod] = useState<AccPaymentMethod>('cash');
  const [amount, setAmount] = useState('');

  const mutation = useMutation({
    mutationFn: (data: ReceivablePayment) =>
      accountingService.payReceivable(receivable!.id, data),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Cobro registrado' });
      qc.invalidateQueries({ queryKey: ['receivables'] });
      qc.invalidateQueries({ queryKey: ['receivables-pending'] });
      qc.invalidateQueries({ queryKey: ['cash-balances'] });
      qc.invalidateQueries({ queryKey: ['daily-flow'] });
      setAmount('');
      onClose();
    },
    onError: (error) => {
      Toast.show({ type: 'error', text1: 'Error', text2: extractErrorMessage(error) });
    },
  });

  const handlePay = () => {
    const payAmount = amount ? Number(amount) : Number(receivable?.balance || 0);
    if (payAmount <= 0) return;
    mutation.mutate({ amount: payAmount, payment_method: method });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" transparent>
      <View className="flex-1 justify-end">
        <View className="bg-white rounded-t-3xl p-6 shadow-xl">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-bold text-gray-900">Registrar Cobro</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </Pressable>
          </View>

          {receivable && (
            <View className="bg-gray-50 rounded-lg p-3 mb-4">
              <Text className="font-medium text-gray-900">{receivable.description}</Text>
              <Text className="text-sm text-gray-500">
                {receivable.client_name} | Pendiente: {formatCurrency(Number(receivable.balance))}
              </Text>
            </View>
          )}

          <Text className="text-sm font-medium text-gray-700 mb-2">Metodo de pago</Text>
          <View className="flex-row flex-wrap mb-4">
            {ACC_PAYMENT_METHODS.map((m) => (
              <Pressable
                key={m.key}
                className={`mr-2 mb-2 px-4 py-2.5 rounded-lg ${
                  method === m.key ? 'bg-primary-500' : 'bg-gray-100'
                }`}
                onPress={() => setMethod(m.key)}
              >
                <Text className={`text-sm font-medium ${method === m.key ? 'text-white' : 'text-gray-600'}`}>
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text className="text-sm font-medium text-gray-700 mb-1">Monto</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-gray-50 mb-4"
            placeholder={`${receivable?.balance || 0} (total pendiente)`}
            placeholderTextColor="#9ca3af"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
          />

          <Pressable
            className={`rounded-lg py-4 items-center ${
              mutation.isPending ? 'bg-gray-300' : 'bg-green-600 active:bg-green-700'
            }`}
            onPress={handlePay}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-base">Confirmar Cobro</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function ReceivablesScreen(): React.ReactElement {
  const { canManageReceivables } = usePermissions();
  const [filter, setFilter] = useState<FilterStatus>('pending');
  const [payingReceivable, setPayingReceivable] = useState<ReceivableListItem | null>(null);

  const isPaid = filter === 'paid' ? true : filter === 'pending' ? false : undefined;

  const { data: receivables, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['receivables', filter],
    queryFn: () =>
      accountingService.getReceivables({ is_paid: isPaid, limit: 200 }).then((r) => r.data),
  });

  const totalPending = (receivables || [])
    .filter((r) => !r.is_paid)
    .reduce((sum, r) => sum + Number(r.balance), 0);

  const filters: { key: FilterStatus; label: string }[] = [
    { key: 'pending', label: 'Pendientes' },
    { key: 'paid', label: 'Cobrados' },
    { key: 'all', label: 'Todos' },
  ];

  return (
    <View className="flex-1">
      <View className="px-4 py-2 bg-white border-b border-gray-100">
        <View className="flex-row items-center justify-between">
          <View className="flex-row">
            {filters.map((f) => (
              <Pressable
                key={f.key}
                className={`mr-2 px-3 py-1.5 rounded-full ${
                  filter === f.key ? 'bg-primary-500' : 'bg-gray-100'
                }`}
                onPress={() => setFilter(f.key)}
              >
                <Text className={`text-sm font-medium ${
                  filter === f.key ? 'text-white' : 'text-gray-600'
                }`}>
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {filter === 'pending' && totalPending > 0 && (
            <Text className="text-sm font-bold text-amber-600">
              {formatCurrency(totalPending)}
            </Text>
          )}
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={BRAND.primary} />
        </View>
      ) : (
        <FlatList
          data={receivables || []}
          keyExtractor={(item) => item.id}
          contentContainerClassName="p-4"
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
          renderItem={({ item }: { item: ReceivableListItem }) => (
            <ReceivableCard
              item={item}
              onPay={() => setPayingReceivable(item)}
              showPayButton={canManageReceivables}
            />
          )}
          ListEmptyComponent={
            <View className="py-20 items-center">
              <Ionicons name="cash-outline" size={48} color="#d1d5db" />
              <Text className="text-gray-400 mt-2">
                {filter === 'pending' ? 'No hay cuentas pendientes' : 'No hay cuentas por cobrar'}
              </Text>
            </View>
          }
        />
      )}

      <PayReceivableModal
        receivable={payingReceivable}
        visible={!!payingReceivable}
        onClose={() => setPayingReceivable(null)}
      />
    </View>
  );
}
