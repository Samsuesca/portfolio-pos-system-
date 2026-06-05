import { useMemo } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Slot, useRouter, usePathname } from 'expo-router';
import { usePermissions } from '../../../src/hooks/usePermissions';

interface TabDef {
  key: string;
  label: string;
  path: string;
}

const ALL_TABS: (TabDef & { requires: string })[] = [
  { key: 'index', label: 'Resumen', path: '/(app)/accounting', requires: 'accounting.view_cash' },
  { key: 'daily-flow', label: 'Flujo del Dia', path: '/(app)/accounting/daily-flow', requires: 'accounting.view_daily_flow' },
  { key: 'expenses', label: 'Gastos', path: '/(app)/accounting/expenses', requires: 'accounting.view_expenses' },
  { key: 'receivables', label: 'CxC', path: '/(app)/accounting/receivables', requires: 'accounting.view_receivables' },
];

export default function AccountingLayout(): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const { hasPermission } = usePermissions();

  const visibleTabs = useMemo(
    () => ALL_TABS.filter((t) => hasPermission(t.requires)),
    [hasPermission]
  );

  const activeTab = visibleTabs.find(
    (t) => pathname === t.path || pathname.endsWith(`/${t.key}`)
  )?.key || visibleTabs[0]?.key || 'index';

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white border-b border-gray-200">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="px-4 py-2"
        >
          {visibleTabs.map((tab) => (
            <Pressable
              key={tab.key}
              className={`mr-2 px-4 py-2 rounded-full ${
                activeTab === tab.key ? 'bg-primary-500' : 'bg-gray-100'
              }`}
              onPress={() => router.replace(tab.path)}
            >
              <Text
                className={`text-sm font-medium ${
                  activeTab === tab.key ? 'text-white' : 'text-gray-600'
                }`}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <Slot />
    </View>
  );
}
