import { useState } from 'react';
import {
  View, Text, FlatList, Pressable, TextInput, ActivityIndicator,
  RefreshControl, Alert, Modal, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { accountingService } from '../../../src/services/accountingService';
import { usePermissions } from '../../../src/hooks/usePermissions';
import { BRAND } from '../../../src/constants/brand';
import { extractErrorMessage } from '../../../src/utils/apiClient';
import { formatCurrency, formatDate } from '../../../src/utils/format';
import type {
  ExpenseListItem, ExpenseCreate, ExpensePayment, AccPaymentMethod, ExpenseCategory,
} from '../../../src/types/api';

type FilterStatus = 'all' | 'pending' | 'paid';

const ACC_PAYMENT_METHODS: { key: AccPaymentMethod; label: string }[] = [
  { key: 'cash', label: 'Efectivo' },
  { key: 'nequi', label: 'Nequi' },
  { key: 'transfer', label: 'Transferencia' },
  { key: 'card', label: 'Tarjeta' },
];

function getColombiaToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

function ExpenseCard({ item, onPay, showPayButton = true }: {
  item: ExpenseListItem;
  onPay: () => void;
  showPayButton?: boolean;
}): React.ReactElement {
  return (
    <View className="bg-white rounded-xl p-4 mb-3 border border-gray-100">
      <View className="flex-row justify-between items-start mb-1">
        <View className="flex-1 mr-2">
          <Text className="font-semibold text-gray-900">{item.description}</Text>
          <Text className="text-xs text-gray-400 mt-0.5">
            {item.category} {item.vendor ? `| ${item.vendor}` : ''}
          </Text>
        </View>
        <Text className="font-bold text-gray-900">{formatCurrency(Number(item.amount))}</Text>
      </View>

      <View className="flex-row items-center justify-between mt-2">
        <View className="flex-row items-center">
          <View className={`px-2 py-0.5 rounded-full ${item.is_paid ? 'bg-green-100' : 'bg-amber-100'}`}>
            <Text className={`text-xs font-medium ${item.is_paid ? 'text-green-700' : 'text-amber-700'}`}>
              {item.is_paid ? 'Pagado' : `Pendiente ${formatCurrency(Number(item.balance))}`}
            </Text>
          </View>
          {item.is_recurring && (
            <View className="ml-2 px-2 py-0.5 rounded-full bg-blue-100">
              <Text className="text-xs text-blue-600">Recurrente</Text>
            </View>
          )}
        </View>
        <Text className="text-xs text-gray-400">{formatDate(item.expense_date)}</Text>
      </View>

      {!item.is_paid && showPayButton && (
        <Pressable
          className="bg-primary-500 rounded-lg py-2 mt-3 items-center active:bg-primary-600"
          onPress={onPay}
        >
          <Text className="text-white font-semibold text-sm">Pagar</Text>
        </Pressable>
      )}
    </View>
  );
}

function CreateExpenseModal({ visible, onClose }: {
  visible: boolean;
  onClose: () => void;
}): React.ReactElement {
  const qc = useQueryClient();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [vendor, setVendor] = useState('');

  const { data: categories } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: () => accountingService.getExpenseCategories().then((r) => r.data),
    enabled: visible,
  });

  const mutation = useMutation({
    mutationFn: (data: ExpenseCreate) => accountingService.createExpense(data),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Gasto registrado' });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['cash-balances'] });
      qc.invalidateQueries({ queryKey: ['expenses-pending-count'] });
      resetAndClose();
    },
    onError: (error) => {
      Toast.show({ type: 'error', text1: 'Error', text2: extractErrorMessage(error) });
    },
  });

  const resetAndClose = () => {
    setDescription('');
    setAmount('');
    setCategory('');
    setVendor('');
    onClose();
  };

  const handleSubmit = () => {
    if (!description.trim() || !amount || !category) {
      Toast.show({ type: 'error', text1: 'Completa los campos requeridos' });
      return;
    }
    mutation.mutate({
      description: description.trim(),
      amount: Number(amount),
      category,
      expense_date: getColombiaToday(),
      vendor: vendor.trim() || null,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        className="flex-1 bg-gray-50"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
          <Pressable onPress={resetAndClose}>
            <Text className="text-primary-500 font-medium">Cancelar</Text>
          </Pressable>
          <Text className="font-semibold text-gray-900">Nuevo Gasto</Text>
          <View className="w-16" />
        </View>

        <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled">
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-1">Descripcion *</Text>
            <TextInput
              className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-white"
              placeholder="Ej: Compra de bolsas"
              placeholderTextColor="#9ca3af"
              value={description}
              onChangeText={setDescription}
            />
          </View>

          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-1">Monto *</Text>
            <TextInput
              className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-white"
              placeholder="0"
              placeholderTextColor="#9ca3af"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />
          </View>

          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">Categoria *</Text>
            <View className="flex-row flex-wrap">
              {(categories || []).filter((c: ExpenseCategory) => c.is_active).map((c: ExpenseCategory) => (
                <Pressable
                  key={c.code}
                  className={`mr-2 mb-2 px-3 py-2 rounded-lg ${
                    category === c.code ? 'bg-primary-500' : 'bg-gray-100'
                  }`}
                  onPress={() => setCategory(c.code)}
                >
                  <Text className={`text-sm ${category === c.code ? 'text-white' : 'text-gray-600'}`}>
                    {c.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="mb-6">
            <Text className="text-sm font-medium text-gray-700 mb-1">Proveedor (opcional)</Text>
            <TextInput
              className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-white"
              placeholder="Nombre del proveedor"
              placeholderTextColor="#9ca3af"
              value={vendor}
              onChangeText={setVendor}
            />
          </View>

          <Pressable
            className={`rounded-lg py-4 items-center ${
              mutation.isPending ? 'bg-gray-300' : 'bg-primary-500 active:bg-primary-600'
            }`}
            onPress={handleSubmit}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-base">Registrar Gasto</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function PayExpenseModal({ expense, visible, onClose }: {
  expense: ExpenseListItem | null;
  visible: boolean;
  onClose: () => void;
}): React.ReactElement {
  const qc = useQueryClient();
  const [method, setMethod] = useState<AccPaymentMethod>('cash');
  const [amount, setAmount] = useState('');
  const [useFallback, setUseFallback] = useState(false);

  const mutation = useMutation({
    mutationFn: (data: ExpensePayment) =>
      accountingService.payExpense(expense!.id, data),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Gasto pagado' });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['cash-balances'] });
      qc.invalidateQueries({ queryKey: ['daily-flow'] });
      qc.invalidateQueries({ queryKey: ['expenses-pending-count'] });
      setAmount('');
      onClose();
    },
    onError: (error) => {
      Toast.show({ type: 'error', text1: 'Error al pagar', text2: extractErrorMessage(error) });
    },
  });

  const handlePay = () => {
    const payAmount = amount ? Number(amount) : Number(expense?.balance || 0);
    if (payAmount <= 0) return;
    mutation.mutate({
      amount: payAmount,
      payment_method: method,
      use_fallback: useFallback,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" transparent>
      <View className="flex-1 justify-end">
        <View className="bg-white rounded-t-3xl p-6 shadow-xl">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-bold text-gray-900">Pagar Gasto</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </Pressable>
          </View>

          {expense && (
            <View className="bg-gray-50 rounded-lg p-3 mb-4">
              <Text className="font-medium text-gray-900">{expense.description}</Text>
              <Text className="text-sm text-gray-500">
                Pendiente: {formatCurrency(Number(expense.balance))}
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
            className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-gray-50 mb-3"
            placeholder={`${expense?.balance || 0} (total pendiente)`}
            placeholderTextColor="#9ca3af"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
          />

          {method === 'cash' && (
            <Pressable
              className="flex-row items-center mb-4"
              onPress={() => setUseFallback(!useFallback)}
            >
              <View className={`w-5 h-5 rounded border mr-2 items-center justify-center ${
                useFallback ? 'bg-primary-500 border-primary-500' : 'border-gray-300'
              }`}>
                {useFallback && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text className="text-sm text-gray-600">
                Usar Caja Mayor si Caja Menor no alcanza
              </Text>
            </Pressable>
          )}

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
              <Text className="text-white font-semibold text-base">Confirmar Pago</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function ExpensesScreen(): React.ReactElement {
  const { canCreateExpense, canPayExpense } = usePermissions();
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [payingExpense, setPayingExpense] = useState<ExpenseListItem | null>(null);

  const isPaid = filter === 'paid' ? true : filter === 'pending' ? false : undefined;

  const { data: expenses, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['expenses', filter],
    queryFn: () =>
      accountingService.getExpenses({ is_paid: isPaid, limit: 100 }).then((r) => r.data),
  });

  const filters: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'pending', label: 'Pendientes' },
    { key: 'paid', label: 'Pagados' },
  ];

  return (
    <View className="flex-1">
      <View className="px-4 py-2 bg-white border-b border-gray-100">
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
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={BRAND.primary} />
        </View>
      ) : (
        <FlatList
          data={expenses || []}
          keyExtractor={(item) => item.id}
          contentContainerClassName="p-4"
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
          renderItem={({ item }: { item: ExpenseListItem }) => (
            <ExpenseCard
              item={item}
              onPay={() => setPayingExpense(item)}
              showPayButton={canPayExpense}
            />
          )}
          ListEmptyComponent={
            <View className="py-20 items-center">
              <Ionicons name="receipt-outline" size={48} color="#d1d5db" />
              <Text className="text-gray-400 mt-2">No hay gastos</Text>
            </View>
          }
        />
      )}

      {canCreateExpense && (
        <Pressable
          className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-primary-500 items-center justify-center shadow-lg active:bg-primary-600"
          onPress={() => setShowCreate(true)}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
      )}

      <CreateExpenseModal visible={showCreate} onClose={() => setShowCreate(false)} />
      <PayExpenseModal
        expense={payingExpense}
        visible={!!payingExpense}
        onClose={() => setPayingExpense(null)}
      />
    </View>
  );
}
