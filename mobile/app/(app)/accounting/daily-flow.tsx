import { useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { accountingService } from '../../../src/services/accountingService';
import { formatCurrency } from '../../../src/utils/format';
import { BRAND } from '../../../src/constants/brand';
import type { AccountDailyFlow, CategoryBreakdown } from '../../../src/types/api';

function getColombiaToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

function formatDisplayDate(dateStr: string): string {
  const today = getColombiaToday();
  if (dateStr === today) return 'Hoy';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

const CATEGORY_LABELS: Record<string, string> = {
  sales: 'Ventas',
  orders: 'Pedidos',
  alterations: 'Arreglos',
  sale_changes: 'Cambios',
  transfers: 'Transferencias',
  expenses: 'Gastos',
  other: 'Otros',
};

function BreakdownSection({ breakdown }: { breakdown: CategoryBreakdown | null }): React.ReactElement | null {
  if (!breakdown) return null;

  const entries = Object.entries(breakdown).filter(
    ([, v]) => v.count > 0
  );

  if (entries.length === 0) return null;

  return (
    <View className="mt-2 pt-2 border-t border-gray-100">
      {entries.map(([key, val]) => (
        <View key={key} className="flex-row justify-between py-1">
          <Text className="text-xs text-gray-500">
            {CATEGORY_LABELS[key] || key} ({val.count})
          </Text>
          <View className="flex-row">
            {Number(val.income) > 0 && (
              <Text className="text-xs text-green-600 mr-3">+{formatCurrency(Number(val.income))}</Text>
            )}
            {Number(val.expense) > 0 && (
              <Text className="text-xs text-red-500">-{formatCurrency(Number(val.expense))}</Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

function AccountFlowCard({ account }: { account: AccountDailyFlow }): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const netFlow = Number(account.net_flow);

  return (
    <Pressable
      className="bg-white rounded-xl p-4 mb-3 border border-gray-100"
      onPress={() => setExpanded(!expanded)}
    >
      <View className="flex-row items-center justify-between mb-2">
        <Text className="font-semibold text-gray-900">{account.account_name}</Text>
        <Text className="text-xs text-gray-400">{account.account_code}</Text>
      </View>

      <View className="flex-row justify-between mb-1">
        <Text className="text-xs text-gray-500">Apertura</Text>
        <Text className="text-sm text-gray-700">{formatCurrency(Number(account.opening_balance))}</Text>
      </View>

      <View className="flex-row justify-between">
        <View className="flex-row items-center">
          <Ionicons name="arrow-up-circle" size={14} color="#16a34a" />
          <Text className="text-xs text-green-600 ml-1">
            +{formatCurrency(Number(account.total_income))} ({account.income_count})
          </Text>
        </View>
        <View className="flex-row items-center">
          <Ionicons name="arrow-down-circle" size={14} color="#ef4444" />
          <Text className="text-xs text-red-500 ml-1">
            -{formatCurrency(Number(account.total_expenses))} ({account.expense_count})
          </Text>
        </View>
      </View>

      <View className="flex-row justify-between mt-2 pt-2 border-t border-gray-100">
        <Text className="font-medium text-gray-700">Cierre</Text>
        <Text className="font-bold text-gray-900">{formatCurrency(Number(account.closing_balance))}</Text>
      </View>

      <View className="flex-row justify-between mt-1">
        <Text className="text-xs text-gray-500">Flujo neto</Text>
        <Text className={`text-xs font-medium ${netFlow >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {netFlow >= 0 ? '+' : ''}{formatCurrency(netFlow)}
        </Text>
      </View>

      {expanded && <BreakdownSection breakdown={account.breakdown_by_category} />}

      <View className="items-center mt-2">
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#9ca3af" />
      </View>
    </Pressable>
  );
}

export default function DailyFlowScreen(): React.ReactElement {
  const [date, setDate] = useState(getColombiaToday);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['daily-flow', date],
    queryFn: () => accountingService.getDailyFlow(date).then((r) => r.data),
    staleTime: 60 * 1000,
  });

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="p-4"
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      <View className="flex-row items-center justify-between mb-4">
        <Pressable
          className="w-10 h-10 rounded-full bg-white border border-gray-200 items-center justify-center"
          onPress={() => setDate(shiftDate(date, -1))}
        >
          <Ionicons name="chevron-back" size={20} color="#374151" />
        </Pressable>

        <View className="items-center">
          <Text className="text-lg font-bold text-gray-900">{formatDisplayDate(date)}</Text>
          {date !== getColombiaToday() && (
            <Pressable onPress={() => setDate(getColombiaToday())}>
              <Text className="text-xs text-primary-500 font-medium">Ir a hoy</Text>
            </Pressable>
          )}
        </View>

        <Pressable
          className="w-10 h-10 rounded-full bg-white border border-gray-200 items-center justify-center"
          onPress={() => setDate(shiftDate(date, 1))}
        >
          <Ionicons name="chevron-forward" size={20} color="#374151" />
        </Pressable>
      </View>

      {isLoading ? (
        <View className="py-20 items-center">
          <ActivityIndicator size="large" color={BRAND.primary} />
        </View>
      ) : (
        <>
          {data?.totals && (
            <View className="bg-primary-500 rounded-xl p-4 mb-4">
              <View className="flex-row justify-between mb-2">
                <Text className="text-primary-100 text-sm">Ingresos</Text>
                <Text className="text-white font-semibold">
                  +{formatCurrency(Number(data.totals.total_income))}
                </Text>
              </View>
              <View className="flex-row justify-between mb-2">
                <Text className="text-primary-100 text-sm">Egresos</Text>
                <Text className="text-white font-semibold">
                  -{formatCurrency(Number(data.totals.total_expenses))}
                </Text>
              </View>
              <View className="border-t border-primary-400 pt-2 flex-row justify-between">
                <Text className="text-white font-medium">Flujo Neto</Text>
                <Text className="text-white font-bold text-lg">
                  {Number(data.totals.net_flow) >= 0 ? '+' : ''}
                  {formatCurrency(Number(data.totals.net_flow))}
                </Text>
              </View>
            </View>
          )}

          {(data?.accounts || []).map((account) => (
            <AccountFlowCard key={account.account_id} account={account} />
          ))}

          {(!data?.accounts || data.accounts.length === 0) && (
            <View className="py-10 items-center">
              <Ionicons name="analytics-outline" size={48} color="#d1d5db" />
              <Text className="text-gray-400 mt-2">Sin movimientos este dia</Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}
