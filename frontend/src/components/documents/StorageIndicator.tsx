/**
 * StorageIndicator Component - Shows storage usage bar
 */
import type { DocumentStorageStats } from '../../types/document';
import { formatFileSize } from '../../types/document';

interface StorageIndicatorProps {
  stats: DocumentStorageStats | null;
  isLoading?: boolean;
}

export default function StorageIndicator({ stats, isLoading = false }: StorageIndicatorProps) {
  if (isLoading || !stats) {
    return (
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border-t">
        <div className="flex-1 h-2 bg-gray-200 rounded-full animate-pulse" />
        <div className="w-24 h-4 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  const percentage = stats.usage_percentage;
  const isWarning = percentage >= 80;
  const isCritical = percentage >= 95;

  const barColor = isCritical
    ? 'bg-red-500'
    : isWarning
    ? 'bg-yellow-500'
    : 'bg-blue-500';

  const textColor = isCritical
    ? 'text-red-600'
    : isWarning
    ? 'text-yellow-600'
    : 'text-gray-600';

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border-t">
      {/* Progress bar */}
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-300`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      {/* Text */}
      <div className={`text-sm ${textColor} whitespace-nowrap`}>
        <span className="font-medium">{formatFileSize(stats.total_size_bytes)}</span>
        <span className="text-gray-400"> / </span>
        <span>{formatFileSize(stats.max_size_bytes)}</span>
        <span className="text-gray-400 ml-1">({percentage.toFixed(1)}%)</span>
      </div>

      {/* Warning message */}
      {isWarning && (
        <span className={`text-xs ${isCritical ? 'text-red-500' : 'text-yellow-500'}`}>
          {isCritical ? 'Almacenamiento casi lleno' : 'Espacio limitado'}
        </span>
      )}
    </div>
  );
}
