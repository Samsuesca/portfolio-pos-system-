import { View, Text } from 'react-native';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export function OfflineBanner(): React.ReactElement | null {
  const isConnected = useNetworkStatus();

  if (isConnected) return null;

  return (
    <View className="bg-red-500 px-4 py-2">
      <Text className="text-white text-center text-sm font-medium">
        Sin conexion a internet
      </Text>
    </View>
  );
}
