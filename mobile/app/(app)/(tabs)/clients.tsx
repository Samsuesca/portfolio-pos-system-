import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, TextInput, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { clientService } from '../../../src/services/clientService';
import { usePermissions } from '../../../src/hooks/usePermissions';
import { BRAND } from '../../../src/constants/brand';
import type { ClientListItem } from '../../../src/types/api';

const PAGE_SIZE = 20;

export default function ClientsScreen(): React.ReactElement {
  const router = useRouter();
  const { canCreateClients } = usePermissions();
  const [search, setSearch] = useState('');

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ['clients', search],
    queryFn: ({ pageParam = 0 }) =>
      clientService
        .list({
          skip: pageParam,
          limit: PAGE_SIZE,
          search: search || undefined,
          is_active: true,
        })
        .then((r) => r.data),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.has_more ? allPages.length * PAGE_SIZE : undefined,
  });

  const clients = data?.pages.flatMap((p) => p.items) ?? [];

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage]);

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 pt-3 pb-2 bg-white border-b border-gray-100">
        <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2">
          <Ionicons name="search" size={18} color="#9ca3af" />
          <TextInput
            className="flex-1 ml-2 text-base text-gray-900"
            placeholder="Buscar por nombre, telefono, cedula..."
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </Pressable>
          )}
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={BRAND.primary} />
        </View>
      ) : (
        <FlatList
          data={clients}
          keyExtractor={(item) => item.id}
          contentContainerClassName="p-4"
          renderItem={({ item }: { item: ClientListItem }) => (
            <Pressable
              className="bg-white rounded-xl p-4 mb-3 border border-gray-100 active:bg-gray-50"
              onPress={() => router.push({ pathname: '/(app)/client-detail', params: { id: item.id } })}
            >
              <View className="flex-row items-center">
                <View className="w-10 h-10 rounded-full bg-primary-100 items-center justify-center mr-3">
                  <Text className="text-primary-500 font-bold">
                    {item.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="font-semibold text-gray-900">{item.name}</Text>
                  <Text className="text-sm text-gray-500">{item.phone || item.code}</Text>
                </View>
                {item.student_count > 0 && (
                  <View className="bg-blue-50 px-2 py-1 rounded-full">
                    <Text className="text-xs text-blue-600">{item.student_count} est.</Text>
                  </View>
                )}
              </View>
            </Pressable>
          )}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />
          }
          ListFooterComponent={
            isFetchingNextPage ? <ActivityIndicator className="py-4" color={BRAND.primary} /> : null
          }
          ListEmptyComponent={
            <View className="py-20 items-center">
              <Ionicons name="people-outline" size={48} color="#d1d5db" />
              <Text className="text-gray-400 mt-2">No hay clientes</Text>
            </View>
          }
        />
      )}

      {canCreateClients && (
        <Pressable
          className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-primary-500 items-center justify-center shadow-lg active:bg-primary-600"
          onPress={() => router.push('/(app)/new-client')}
        >
          <Ionicons name="person-add" size={24} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}
