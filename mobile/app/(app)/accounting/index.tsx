import { View, Text, ScrollView, RefreshControl, ActivityIndicator, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { accountingService } from '../../../src/services/accountingService';
import { formatCurrency } from '../../../src/utils/format';
import { BRAND } from '../../../src/constants/brand';
import type { CashBalanceInfo } from '../../../src/types/api';

function AccountCard({ account, icon }: {
  account: CashBalanceInfo | null;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}): React.ReactElement | null {
  if (!account) return null;
  const balance = Number(account.balance);
  return (
    <View className="bg-white rounded-xl p-4 mb-3 border border-gray-100">
      <View className="flex-row items-center mb-2">
        <View className="w-9 h-9 rounded-lg bg-primary-50 items-center justify-center">
          <Ionicons name={icon} size={20} color={BRAND.primary} />
        </View>
        <Text className="font-medium text-gray-900 ml-3">{account.name}</Text>
      </View>
      <Text className={`text-2xl font-bold ${balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
        {formatCurrency(balance)}
      </Text>
    </View>
  );
}

export default function AccountingSummary(): React.ReactElement {
  const router = useRouter();

  const { data: balances, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['cash-balances'],
    queryFn: () => accountingService.getCashBalances().then((r) => r.data),
    staleTime: 2 * 60 * 1000,
  });

  const { data: pendingExpenses } = useQuery({
    queryKey: ['expenses-pending-count'],
    queryFn: () =>
      accountingService.getExpenses({ is_paid: false, limit: 1 }).then((r) => r.data),
  });

  const { data: pendingReceivables } = useQuery({
    queryKey: ['receivables-pending'],
    queryFn: () => accountingService.getPendingReceivables().then((r) => r.data),
  });

  const totalReceivable = (pendingReceivables || []).reduce(
    (sum, r) => sum + Number(r.balance), 0
  );

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={BRAND.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="p-4"
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      <View className="bg-primary-500 rounded-xl p-5 mb-4">
        <Text className="text-primary-100 text-sm font-medium">Liquidez Total</Text>
        <Text className="text-white text-3xl font-bold mt-1">
          {formatCurrency(Number(balances?.total_liquid || 0))}
        </Text>
      </View>

      <Text className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
        Cuentas
      </Text>

      <AccountCard account={balances?.caja_menor ?? null} icon="wallet-outline" />
      <AccountCard account={balances?.caja_mayor ?? null} icon="cash-outline" />
      <AccountCard account={balances?.nequi ?? null} icon="phone-portrait-outline" />
      <AccountCard account={balances?.banco ?? null} icon="business-outline" />

      {/* Legacy fallback if 4-account not set up */}
      {!balances?.caja_menor && balances?.caja && (
        <AccountCard account={balances.caja} icon="wallet-outline" />
      )}
      {!balances?.caja_menor && balances?.banco && (
        <AccountCard account={balances.banco} icon="business-outline" />
      )}

      <Text className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3 mt-4">
        Acciones Rapidas
      </Text>

      <Pressable
        className="bg-white rounded-xl p-4 mb-3 border border-gray-100 flex-row items-center active:bg-gray-50"
        onPress={() => router.push('/(app)/accounting/expenses')}
      >
        <View className="w-10 h-10 rounded-lg bg-red-50 items-center justify-center">
          <Ionicons name="trending-down-outline" size={20} color="#ef4444" />
        </View>
        <View className="flex-1 ml-3">
          <Text className="font-medium text-gray-900">Gastos Pendientes</Text>
          <Text className="text-sm text-gray-500">
            {pendingExpenses?.length === 1 ? '1+ sin pagar' : `${pendingExpenses?.length || 0} sin pagar`}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
      </Pressable>

      <Pressable
        className="bg-white rounded-xl p-4 mb-3 border border-gray-100 flex-row items-center active:bg-gray-50"
        onPress={() => router.push('/(app)/accounting/receivables')}
      >
        <View className="w-10 h-10 rounded-lg bg-amber-50 items-center justify-center">
          <Ionicons name="trending-up-outline" size={20} color="#f59e0b" />
        </View>
        <View className="flex-1 ml-3">
          <Text className="font-medium text-gray-900">Cuentas por Cobrar</Text>
          <Text className="text-sm text-gray-500">
            {formatCurrency(totalReceivable)} pendiente
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
      </Pressable>

      <Pressable
        className="bg-white rounded-xl p-4 mb-6 border border-gray-100 flex-row items-center active:bg-gray-50"
        onPress={() => router.push('/(app)/accounting/daily-flow')}
      >
        <View className="w-10 h-10 rounded-lg bg-blue-50 items-center justify-center">
          <Ionicons name="analytics-outline" size={20} color="#3b82f6" />
        </View>
        <View className="flex-1 ml-3">
          <Text className="font-medium text-gray-900">Flujo del Dia</Text>
          <Text className="text-sm text-gray-500">Movimientos por cuenta</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
      </Pressable>
    </ScrollView>
  );
}
