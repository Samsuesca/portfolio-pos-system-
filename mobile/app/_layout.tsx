import '../global.css';
import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { BRAND } from '../src/constants/brand';
import Toast from 'react-native-toast-message';
import { queryClient } from '../src/hooks/useQueryConfig';
import { useAuthStore } from '../src/stores/authStore';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { OfflineBanner } from '../src/components/OfflineBanner';
import { usePermissionsRefresh } from '../src/hooks/usePermissionsRefresh';

function AuthGuard(): React.ReactElement {
  const { isAuthenticated, isHydrated } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  // Polling cada 60s para sincronizar permisos sin re-login.
  usePermissionsRefresh();

  useEffect(() => {
    if (!isHydrated) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(app)/(tabs)/home');
    }
  }, [isAuthenticated, isHydrated, segments]);

  if (!isHydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color={BRAND.primary} />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout(): React.ReactElement {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <OfflineBanner />
        <AuthGuard />
        <Toast />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
