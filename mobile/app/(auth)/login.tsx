import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useAuthStore } from '../../src/stores/authStore';
import { useGoogleAuth } from '../../src/hooks/useGoogleAuth';

export default function LoginScreen(): React.ReactElement {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, googleLogin, isLoading, error, clearError } = useAuthStore();
  const { request, response, promptAsync, isConfigured: googleConfigured } = useGoogleAuth();

  useEffect(() => {
    if (response?.type === 'success' && response.params?.id_token) {
      googleLogin(response.params.id_token).catch(() => {});
    }
  }, [response]);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) return;
    try {
      await login({ username: username.trim(), password });
    } catch {
      // error is set in the store
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerClassName="flex-1 justify-center px-8"
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center mb-10">
          <View className="w-20 h-20 rounded-2xl bg-primary-500 items-center justify-center mb-4">
            <Text className="text-white text-3xl font-bold">UC</Text>
          </View>
          <Text className="text-2xl font-bold text-gray-900">
            UCR Vendedoras
          </Text>
          <Text className="text-gray-500 mt-1">
            Uniformes Consuelo Rios
          </Text>
        </View>

        {error && (
          <Pressable
            className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4"
            onPress={clearError}
          >
            <Text className="text-red-700 text-sm text-center">{error}</Text>
          </Pressable>
        )}

        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1">
            Usuario
          </Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-gray-50"
            placeholder="Tu nombre de usuario"
            placeholderTextColor="#9ca3af"
            value={username}
            onChangeText={(text) => {
              clearError();
              setUsername(text);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
        </View>

        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-700 mb-1">
            Contrasena
          </Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-gray-50"
            placeholder="Tu contrasena"
            placeholderTextColor="#9ca3af"
            value={password}
            onChangeText={(text) => {
              clearError();
              setPassword(text);
            }}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />
        </View>

        <Pressable
          className={`rounded-lg py-4 items-center ${
            isLoading || !username.trim() || !password.trim()
              ? 'bg-gray-300'
              : 'bg-primary-500 active:bg-primary-600'
          }`}
          onPress={handleLogin}
          disabled={isLoading || !username.trim() || !password.trim()}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">
              Iniciar sesion
            </Text>
          )}
        </Pressable>

        {googleConfigured && (
          <>
            <View className="flex-row items-center my-6">
              <View className="flex-1 h-px bg-gray-200" />
              <Text className="mx-3 text-xs text-gray-400">o continuar con</Text>
              <View className="flex-1 h-px bg-gray-200" />
            </View>

            <Pressable
              className={`rounded-lg py-4 items-center border border-gray-300 ${
                !request || isLoading ? 'bg-gray-100' : 'bg-white active:bg-gray-50'
              }`}
              onPress={() => promptAsync()}
              disabled={!request || isLoading}
            >
              <Text className="text-gray-700 font-semibold text-base">
                Continuar con Google
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
