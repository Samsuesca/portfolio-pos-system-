import { useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable, Modal, TextInput, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Redirect } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { clientService } from '../../src/services/clientService';
import { extractErrorMessage } from '../../src/utils/apiClient';
import { useSchoolStore } from '../../src/stores/schoolStore';
import { BRAND } from '../../src/constants/brand';
import type { ClientStudentCreate } from '../../src/types/api';

export default function ClientDetailScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const availableSchools = useSchoolStore((s) => s.availableSchools);

  if (!id) return <Redirect href="/(app)/(tabs)/clients" />;

  const [showStudentModal, setShowStudentModal] = useState(false);
  const [studentSchoolId, setStudentSchoolId] = useState(availableSchools[0]?.id || '');
  const [studentName, setStudentName] = useState('');
  const [studentGrade, setStudentGrade] = useState('');
  const [studentSection, setStudentSection] = useState('');

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: () => clientService.getDetail(id).then((r) => r.data),
  });

  const addStudentMutation = useMutation({
    mutationFn: (data: ClientStudentCreate) => clientService.addStudent(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', id] });
      setShowStudentModal(false);
      setStudentName('');
      setStudentGrade('');
      setStudentSection('');
      Toast.show({ type: 'success', text1: 'Estudiante agregado' });
    },
    onError: (err) => {
      Toast.show({ type: 'error', text1: 'Error', text2: extractErrorMessage(err) });
    },
  });

  const removeStudentMutation = useMutation({
    mutationFn: (studentId: string) => clientService.removeStudent(id, studentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', id] });
      Toast.show({ type: 'success', text1: 'Estudiante eliminado' });
    },
    onError: (err) => {
      Toast.show({ type: 'error', text1: 'Error', text2: extractErrorMessage(err) });
    },
  });

  const handleAddStudent = () => {
    if (!studentName.trim() || studentName.trim().length < 2) {
      Toast.show({ type: 'error', text1: 'El nombre debe tener al menos 2 caracteres' });
      return;
    }
    if (!studentSchoolId) {
      Toast.show({ type: 'error', text1: 'Selecciona un colegio' });
      return;
    }
    addStudentMutation.mutate({
      school_id: studentSchoolId,
      student_name: studentName.trim(),
      student_grade: studentGrade.trim() || null,
      student_section: studentSection.trim() || null,
    });
  };

  const confirmRemoveStudent = (studentId: string, name: string) => {
    Alert.alert('Eliminar estudiante', `Eliminar a ${name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => removeStudentMutation.mutate(studentId) },
    ]);
  };

  if (isLoading || !client) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color={BRAND.primary} />
      </View>
    );
  }

  return (
    <>
      <ScrollView className="flex-1 bg-gray-50">
        <View className="bg-white p-4 mb-3">
          <View className="items-center mb-3">
            <View className="w-16 h-16 rounded-full bg-primary-100 items-center justify-center mb-2">
              <Text className="text-primary-500 font-bold text-2xl">{client.name.charAt(0).toUpperCase()}</Text>
            </View>
            <Text className="text-xl font-bold text-gray-900">{client.name}</Text>
            <Text className="text-sm text-gray-500">{client.code}</Text>
          </View>

          {client.phone && (
            <View className="flex-row items-center py-2">
              <Ionicons name="call-outline" size={18} color="#6b7280" />
              <Text className="text-gray-700 ml-2">{client.phone}</Text>
            </View>
          )}
          {client.email && (
            <View className="flex-row items-center py-2">
              <Ionicons name="mail-outline" size={18} color="#6b7280" />
              <Text className="text-gray-700 ml-2">{client.email}</Text>
            </View>
          )}
          {client.address && (
            <View className="flex-row items-center py-2">
              <Ionicons name="location-outline" size={18} color="#6b7280" />
              <Text className="text-gray-700 ml-2">{client.address}</Text>
            </View>
          )}

          <Pressable
            className="flex-row items-center justify-center mt-3 border border-primary-500 rounded-lg py-3"
            onPress={() => router.push({ pathname: '/(app)/edit-client', params: { id } })}
          >
            <Ionicons name="create-outline" size={18} color={BRAND.primary} />
            <Text className="text-primary-500 font-semibold ml-2">Editar Cliente</Text>
          </Pressable>
        </View>

        <View className="bg-white p-4 mb-3">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="font-semibold text-gray-900">Estudiantes</Text>
            <Pressable className="flex-row items-center bg-primary-500 px-3 py-1.5 rounded-lg" onPress={() => setShowStudentModal(true)}>
              <Ionicons name="add" size={16} color="#fff" />
              <Text className="text-white text-sm font-medium ml-1">Agregar</Text>
            </Pressable>
          </View>
          {client.students && client.students.length > 0 ? (
            client.students.map((student) => (
              <View key={student.id} className="flex-row justify-between items-center py-2 border-b border-gray-100">
                <View className="flex-1">
                  <Text className="font-medium text-gray-900">{student.student_name}</Text>
                  <Text className="text-sm text-gray-500">
                    {student.school_name} {student.student_grade ? `| ${student.student_grade}` : ''}
                  </Text>
                </View>
                <Pressable onPress={() => confirmRemoveStudent(student.id, student.student_name)}>
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </Pressable>
              </View>
            ))
          ) : (
            <Text className="text-gray-400 text-sm">Sin estudiantes registrados</Text>
          )}
        </View>

        {client.notes && (
          <View className="bg-white p-4 mb-3">
            <Text className="font-semibold text-gray-900 mb-2">Notas</Text>
            <Text className="text-gray-600">{client.notes}</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={showStudentModal} animationType="slide" transparent>
        <Pressable className="flex-1" onPress={() => setShowStudentModal(false)} />
        <View className="bg-white rounded-t-2xl px-5 pt-5 pb-8">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold text-gray-900">Agregar Estudiante</Text>
            <Pressable onPress={() => setShowStudentModal(false)}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </Pressable>
          </View>

          <Text className="text-sm font-medium text-gray-700 mb-1">Colegio *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
            {availableSchools.map((school) => (
              <Pressable
                key={school.id}
                className={`mr-2 px-4 py-2.5 rounded-lg ${studentSchoolId === school.id ? 'bg-primary-500' : 'bg-gray-100'}`}
                onPress={() => setStudentSchoolId(school.id)}
              >
                <Text className={`text-sm font-medium ${studentSchoolId === school.id ? 'text-white' : 'text-gray-600'}`}>{school.name}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text className="text-sm font-medium text-gray-700 mb-1">Nombre *</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-gray-50 mb-3"
            placeholder="Nombre del estudiante"
            placeholderTextColor="#9ca3af"
            value={studentName}
            onChangeText={setStudentName}
          />

          <View className="flex-row mb-3">
            <View className="flex-1 mr-2">
              <Text className="text-sm font-medium text-gray-700 mb-1">Grado</Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-gray-50"
                placeholder="5° Primaria"
                placeholderTextColor="#9ca3af"
                value={studentGrade}
                onChangeText={setStudentGrade}
              />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-gray-700 mb-1">Seccion</Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-gray-50"
                placeholder="A"
                placeholderTextColor="#9ca3af"
                value={studentSection}
                onChangeText={setStudentSection}
              />
            </View>
          </View>

          <Pressable
            className={`rounded-lg py-4 items-center ${addStudentMutation.isPending || !studentName.trim() || !studentSchoolId ? 'bg-gray-300' : 'bg-primary-500 active:bg-primary-600'}`}
            onPress={handleAddStudent}
            disabled={addStudentMutation.isPending || !studentName.trim() || !studentSchoolId}
          >
            {addStudentMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-base">Agregar Estudiante</Text>
            )}
          </Pressable>
        </View>
      </Modal>
    </>
  );
}
