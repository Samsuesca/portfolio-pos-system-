import type { Ionicons } from '@expo/vector-icons';
import type { PaymentMethod } from '../types/api';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export interface PaymentMethodOption {
  key: PaymentMethod;
  value: string;
  label: string;
  icon: IconName;
}

export const PAYMENT_METHODS: PaymentMethodOption[] = [
  { key: 'CASH', value: 'cash', label: 'Efectivo', icon: 'cash-outline' },
  { key: 'NEQUI', value: 'nequi', label: 'Nequi', icon: 'phone-portrait-outline' },
  { key: 'TRANSFER', value: 'transfer', label: 'Transferencia', icon: 'swap-horizontal-outline' },
  { key: 'CREDIT', value: 'credit', label: 'Credito', icon: 'time-outline' },
];
