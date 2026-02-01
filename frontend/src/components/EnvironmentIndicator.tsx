/**
 * Environment Indicator - Shows current environment in the UI
 */
import { useConfigStore, getEnvironmentType, getEnvironmentLabel, getEnvironmentColor } from '../stores/configStore';
import { AlertTriangle, Wifi, WifiOff, Server } from 'lucide-react';

interface EnvironmentIndicatorProps {
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export function EnvironmentIndicator({ showLabel = true, size = 'sm' }: EnvironmentIndicatorProps) {
  const { apiUrl, isOnline } = useConfigStore();
  const envLabel = getEnvironmentLabel(apiUrl);
  const envColor = getEnvironmentColor(apiUrl);

  const sizeClasses = size === 'sm'
    ? 'text-xs px-2 py-0.5'
    : 'text-sm px-3 py-1';

  return (
    <div className={`inline-flex items-center gap-1.5 ${sizeClasses} rounded-full text-white ${envColor}`}>
      {isOnline ? (
        <Wifi className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
      ) : (
        <WifiOff className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
      )}
      {showLabel && <span className="font-medium">{envLabel}</span>}
    </div>
  );
}

/**
 * Development Warning Banner - Shows warning when in non-production environment
 */
export function DevelopmentBanner() {
  const { apiUrl } = useConfigStore();
  const envType = getEnvironmentType(apiUrl);

  // Don't show banner in production
  if (envType === 'production') {
    return null;
  }

  const bannerConfig = {
    development: {
      bg: 'bg-yellow-500',
      text: 'MODO DESARROLLO - Los datos pueden ser de prueba',
      icon: AlertTriangle,
    },
    lan: {
      bg: 'bg-blue-500',
      text: 'RED LOCAL - Conectado al servidor de testing',
      icon: Server,
    },
    custom: {
      bg: 'bg-purple-500',
      text: 'SERVIDOR PERSONALIZADO - Verifique la conexión',
      icon: Server,
    },
  };

  const config = bannerConfig[envType];
  const Icon = config.icon;

  return (
    <div className={`${config.bg} text-white text-center py-1 px-4 text-sm font-medium flex items-center justify-center gap-2`}>
      <Icon className="w-4 h-4" />
      <span>{config.text}</span>
    </div>
  );
}

export default EnvironmentIndicator;
