import { View, Text, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSchoolStore } from '../../src/stores/schoolStore';
import { BRAND } from '../../src/constants/brand';
import { queryClient } from '../../src/hooks/useQueryConfig';
import type { School } from '../../src/types/api';

export default function SchoolSelectorScreen(): React.ReactElement {
  const router = useRouter();
  const { availableSchools, currentSchool, selectSchool, isLoading } = useSchoolStore();

  const handleSelect = (school: School) => {
    selectSchool(school);
    queryClient.invalidateQueries();
    router.back();
  };

  return (
    <View className="flex-1 bg-gray-50">
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={BRAND.primary} />
        </View>
      ) : (
        <FlatList
          data={availableSchools}
          keyExtractor={(item) => item.id}
          contentContainerClassName="p-4"
          renderItem={({ item }) => (
            <Pressable
              className={`bg-white rounded-xl p-4 mb-3 flex-row items-center border ${
                currentSchool?.id === item.id
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200'
              }`}
              onPress={() => handleSelect(item)}
            >
              <View className="w-12 h-12 rounded-lg bg-primary-100 items-center justify-center mr-3">
                <Text className="text-primary-500 font-bold text-lg">
                  {item.code.slice(0, 2)}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="font-semibold text-gray-900">{item.name}</Text>
                <Text className="text-sm text-gray-500">{item.code}</Text>
              </View>
              {currentSchool?.id === item.id && (
                <Ionicons name="checkmark-circle" size={24} color={BRAND.primary} />
              )}
            </Pressable>
          )}
          ListEmptyComponent={
            <View className="py-10 items-center">
              <Text className="text-gray-500">No tienes colegios asignados</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
