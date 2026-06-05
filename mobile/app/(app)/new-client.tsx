import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { clientService } from '../../src/services/clientService';
import { extractErrorMessage } from '../../src/utils/apiClient';
import type { ClientCreate } from '../../src/types/api';

export default function NewClientScreen(): React.ReactElement {
  const router = useRouter();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [studentName, setStudentName] = useState('');

  const mutation = useMutation({
    mutationFn: (data: ClientCreate) => clientService.create(data),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Cliente creado exitosamente' });
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['client-search'] });
      router.back();
    },
    onError: (error) => {
      Toast.show({ type: 'error', text1: 'Error', text2: extractErrorMessage(error) });
    },
  });

  const handleSubmit = () => {
    if (!name.trim() || name.trim().length < 3) {
      Toast.show({ type: 'error', text1: 'El nombre debe tener al menos 3 caracteres' });
      return;
    }
    mutation.mutate({
      name: name.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      student_name: studentName.trim() || null,
    });
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled">
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1">
            Nombre *
          </Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-white"
            placeholder="Nombre completo"
            placeholderTextColor="#9ca3af"
            value={name}
            onChangeText={setName}
            autoFocus
          />
        </View>

        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1">Telefono</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-white"
            placeholder="Numero de telefono"
            placeholderTextColor="#9ca3af"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </View>

        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1">Correo</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-white"
            placeholder="correo@ejemplo.com"
            placeholderTextColor="#9ca3af"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-700 mb-1">Nombre del estudiante</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-white"
            placeholder="Nombre del estudiante (opcional)"
            placeholderTextColor="#9ca3af"
            value={studentName}
            onChangeText={setStudentName}
          />
        </View>

        <Pressable
          className={`rounded-lg py-4 items-center ${
            mutation.isPending || !name.trim() ? 'bg-gray-300' : 'bg-primary-500 active:bg-primary-600'
          }`}
          onPress={handleSubmit}
          disabled={mutation.isPending || !name.trim()}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">Crear Cliente</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
