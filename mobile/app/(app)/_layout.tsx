import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useSchoolStore } from '../../src/stores/schoolStore';
import { BRAND } from '../../src/constants/brand';

export default function AppLayout(): React.ReactElement {
  const loadSchools = useSchoolStore((s) => s.loadSchools);

  useEffect(() => {
    loadSchools();
  }, []);

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="sale-detail"
        options={{
          title: 'Detalle de Venta',
          presentation: 'modal',
          headerTintColor: BRAND.primary,
        }}
      />
      <Stack.Screen
        name="new-sale"
        options={{
          title: 'Nueva Venta',
          presentation: 'fullScreenModal',
          headerTintColor: BRAND.primary,
        }}
      />
      <Stack.Screen
        name="client-detail"
        options={{
          title: 'Detalle de Cliente',
          presentation: 'modal',
          headerTintColor: BRAND.primary,
        }}
      />
      <Stack.Screen
        name="new-client"
        options={{
          title: 'Nuevo Cliente',
          presentation: 'modal',
          headerTintColor: BRAND.primary,
        }}
      />
      <Stack.Screen
        name="edit-client"
        options={{
          title: 'Editar Cliente',
          presentation: 'modal',
          headerTintColor: BRAND.primary,
        }}
      />
      <Stack.Screen
        name="new-order"
        options={{
          title: 'Nuevo Pedido',
          presentation: 'fullScreenModal',
          headerTintColor: BRAND.primary,
        }}
      />
      <Stack.Screen
        name="order-detail"
        options={{
          title: 'Detalle de Pedido',
          presentation: 'modal',
          headerTintColor: BRAND.primary,
        }}
      />
      <Stack.Screen
        name="inventory"
        options={{
          title: 'Inventario',
          headerTintColor: BRAND.primary,
        }}
      />
      <Stack.Screen
        name="orders"
        options={{
          title: 'Pedidos Pendientes',
          headerTintColor: BRAND.primary,
        }}
      />
      <Stack.Screen
        name="school-selector"
        options={{
          title: 'Seleccionar Colegio',
          presentation: 'modal',
          headerTintColor: BRAND.primary,
        }}
      />
      <Stack.Screen
        name="accounting"
        options={{
          title: 'Contabilidad',
          headerTintColor: BRAND.primary,
        }}
      />
      <Stack.Screen
        name="new-sale-change"
        options={{
          title: 'Nuevo Cambio',
          presentation: 'fullScreenModal',
          headerTintColor: BRAND.primary,
        }}
      />
      <Stack.Screen
        name="sale-changes"
        options={{
          title: 'Cambios y Devoluciones',
          headerTintColor: BRAND.primary,
        }}
      />
      <Stack.Screen
        name="sale-change-detail"
        options={{
          title: 'Detalle de Cambio',
          presentation: 'modal',
          headerTintColor: BRAND.primary,
        }}
      />
    </Stack>
  );
}
