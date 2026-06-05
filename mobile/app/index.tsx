import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/stores/authStore';

export default function Index(): React.ReactElement {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (isAuthenticated) {
    return <Redirect href="/(app)/(tabs)/home" />;
  }

  return <Redirect href="/(auth)/login" />;
}
