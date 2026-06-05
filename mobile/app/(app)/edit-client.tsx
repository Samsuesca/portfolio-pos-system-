import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, Redirect } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { clientService } from '../../src/services/clientService';
import { extractErrorMessage } from '../../src/utils/apiClient';
import { BRAND } from '../../src/constants/brand';
import type { ClientUpdate } from '../../src/types/api';

export default function EditClientScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  if (!id) return <Redirect href="/(app)/(tabs)/clients" />;

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: () => clientService.getDetail(id).then((r) => r.data),
  });

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentGrade, setStudentGrade] = useState('');

  useEffect(() => {
    if (client) {
      setName(client.name || '');
      setPhone(client.phone || '');
      setEmail(client.email || '');
      setAddress(client.address || '');
      setNotes(client.notes || '');
      setStudentName(client.student_name || '');
      setStudentGrade(client.student_grade || '');
    }
  }, [client]);

  const mutation = useMutation({
    mutationFn: (data: ClientUpdate) => clientService.update(id, data),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Cliente actualizado exitosamente' });
      qc.invalidateQueries({ queryKey: ['client', id] });
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
    if (phone.trim() && !/^3\d{9}$/.test(phone.trim())) {
      Toast.show({ type: 'error', text1: 'El telefono debe ser 10 digitos empezando con 3' });
      return;
    }
    mutation.mutate({
      name: name.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
      student_name: studentName.trim() || null,
      student_grade: studentGrade.trim() || null,
    });
  };

  if (isLoading || !client) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color={BRAND.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled">
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1">Nombre *</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-white"
            placeholder="Nombre completo"
            placeholderTextColor="#9ca3af"
            value={name}
            onChangeText={setName}
          />
        </View>

        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1">Telefono</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-white"
            placeholder="3001234567"
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

        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1">Direccion</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-white"
            placeholder="Direccion (opcional)"
            placeholderTextColor="#9ca3af"
            value={address}
            onChangeText={setAddress}
          />
        </View>

        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1">Estudiante</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-white mb-2"
            placeholder="Nombre del estudiante"
            placeholderTextColor="#9ca3af"
            value={studentName}
            onChangeText={setStudentName}
          />
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-white"
            placeholder="Grado (ej: 5° Primaria)"
            placeholderTextColor="#9ca3af"
            value={studentGrade}
            onChangeText={setStudentGrade}
          />
        </View>

        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-700 mb-1">Notas</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-white"
            placeholder="Notas adicionales"
            placeholderTextColor="#9ca3af"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
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
            <Text className="text-white font-semibold text-base">Guardar Cambios</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
