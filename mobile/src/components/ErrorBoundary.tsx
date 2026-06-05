import React from 'react';
import { View, Text, Pressable } from 'react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <View className="flex-1 items-center justify-center bg-white px-6">
          <Text className="text-2xl font-bold text-gray-800 mb-2">
            Algo salio mal
          </Text>
          <Text className="text-gray-500 text-center mb-6">
            Ocurrio un error inesperado. Por favor, intenta de nuevo.
          </Text>
          <Pressable
            className="bg-primary-500 px-6 py-3 rounded-lg"
            onPress={() => this.setState({ hasError: false })}
          >
            <Text className="text-white font-semibold">Reintentar</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}
