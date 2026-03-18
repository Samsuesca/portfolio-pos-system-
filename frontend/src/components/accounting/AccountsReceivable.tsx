/**
 * AccountsReceivable - Accounts receivable (CxC) management component
 * With filtering by origin type and summary breakdown
 */
import React, { useState, useMemo } from 'react';
import { Plus, Users, ShoppingBag, Package, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency } from '../../utils/formatting';
import { formatDateSpanish } from '../DatePicker';
import type { ReceivablesPayablesSummary, AccountsReceivableListItem } from './types';

interface AccountsReceivableProps {
  summary: ReceivablesPayablesSummary | null;
  receivablesList: AccountsReceivableListItem[];
  onCreateReceivable: () => void;
  onPayReceivable: (receivable: AccountsReceivableListItem) => void;
}

type OriginFilter = 'all' | 'order' | 'manual' | 'sale';
type OriginType = 'order' | 'manual' | 'sale';

// Helper to get origin type from item
const getOriginType = (item: AccountsReceivableListItem): OriginType => {
  if (item.origin_type === 'sale' || item.sale_id) return 'sale';
  if (item.origin_type === 'order' || item.order_id) return 'order';
  return 'manual';
};

// Helper to get origin label and icon
const getOriginInfo = (item: AccountsReceivableListItem) => {
  if (item.origin_type === 'sale' && item.sale_code) {
    return {
      label: `Venta ${item.sale_code}`,
      icon: ShoppingBag,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    };
  }
  if (item.origin_type === 'order' && item.order_code) {
    return {
      label: `${item.order_code}`,
      icon: Package,
      color: 'text-brand-600',
      bgColor: 'bg-brand-50',
      status: item.order_status
    };
  }
  return {
    label: 'Manual',
    icon: FileText,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50'
  };
};

// Helper to translate order status
const getOrderStatusLabel = (status: string | null | undefined) => {
  if (!status) return null;
  const statusMap: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pendiente', color: 'text-orange-600 bg-orange-50' },
    in_production: { label: 'En producción', color: 'text-brand-600 bg-brand-50' },
    ready: { label: 'Listo', color: 'text-green-600 bg-green-50' },
    delivered: { label: 'Entregado', color: 'text-gray-600 bg-gray-100' },
    cancelled: { label: 'Cancelado', color: 'text-red-600 bg-red-50' }
  };
  return statusMap[status] || { label: status, color: 'text-gray-600 bg-gray-50' };
};

const AccountsReceivable: React.FC<AccountsReceivableProps> = ({
  summary,
  receivablesList,
  onCreateReceivable,
  onPayReceivable
}) => {
  const [activeFilter, setActiveFilter] = useState<OriginFilter>('all');
  const [isListExpanded, setIsListExpanded] = useState(true);

  const formatDate = (dateStr: string) => formatDateSpanish(dateStr);

  // Calculate summary by origin type
  const summaryByType = useMemo(() => {
    const result = {
      order: { count: 0, total: 0, pending: 0 },
      manual: { count: 0, total: 0, pending: 0 },
      sale: { count: 0, total: 0, pending: 0 }
    };

    receivablesList.forEach(item => {
      const type = getOriginType(item);
      const balance = Number(item.balance) || 0;
      result[type].count++;
      result[type].total += Number(item.amount) || 0;
      if (!item.is_paid) {
        result[type].pending += balance;
      }
    });

    return result;
  }, [receivablesList]);

  // Filter list based on active filter
  const filteredList = useMemo(() => {
    if (activeFilter === 'all') return receivablesList;
    return receivablesList.filter(item => getOriginType(item) === activeFilter as OriginType);
  }, [receivablesList, activeFilter]);

  // Filter tabs configuration
  const filterTabs: { key: OriginFilter; label: string; icon: React.ElementType; color: string }[] = [
    { key: 'all', label: 'Todas', icon: Users, color: 'blue' },
    { key: 'order', label: 'Encargos', icon: Package, color: 'blue' },
    { key: 'manual', label: 'Manuales', icon: FileText, color: 'gray' },
    { key: 'sale', label: 'Ventas', icon: ShoppingBag, color: 'green' }
  ];

  return (
    <>
      {/* Summary Cards with breakdown by type */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {/* Total Pendiente - calculated from list data for consistency */}
        <div
          className={`bg-white rounded-lg shadow-sm border p-3 cursor-pointer transition-colors ${
            activeFilter === 'all' ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-brand-300'
          }`}
          onClick={() => setActiveFilter('all')}
        >
          <p className="text-xs font-medium text-gray-500">Total Pendiente</p>
          <p className="text-lg font-bold text-brand-600">
            {formatCurrency(summaryByType.order.pending + summaryByType.manual.pending + summaryByType.sale.pending)}
          </p>
          <p className="text-xs text-gray-400">{receivablesList.length} cuenta(s)</p>
        </div>

        {/* Encargos */}
        <div
          className={`bg-white rounded-lg shadow-sm border p-3 cursor-pointer transition-colors ${
            activeFilter === 'order' ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-brand-300'
          }`}
          onClick={() => setActiveFilter(activeFilter === 'order' ? 'all' : 'order')}
        >
          <div className="flex items-center gap-1">
            <Package className="w-3 h-3 text-brand-600" />
            <p className="text-xs font-medium text-gray-500">Encargos</p>
          </div>
          <p className="text-lg font-bold text-brand-600">{formatCurrency(summaryByType.order.pending)}</p>
          <p className="text-xs text-gray-400">{summaryByType.order.count} cuenta(s)</p>
        </div>

        {/* Manuales */}
        <div
          className={`bg-white rounded-lg shadow-sm border p-3 cursor-pointer transition-colors ${
            activeFilter === 'manual' ? 'border-gray-500 bg-gray-50' : 'border-gray-200 hover:border-gray-400'
          }`}
          onClick={() => setActiveFilter(activeFilter === 'manual' ? 'all' : 'manual')}
        >
          <div className="flex items-center gap-1">
            <FileText className="w-3 h-3 text-gray-600" />
            <p className="text-xs font-medium text-gray-500">Manuales</p>
          </div>
          <p className="text-lg font-bold text-gray-700">{formatCurrency(summaryByType.manual.pending)}</p>
          <p className="text-xs text-gray-400">{summaryByType.manual.count} cuenta(s)</p>
        </div>

        {/* Vencidas */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
          <p className="text-xs font-medium text-gray-500">Vencidas</p>
          <p className="text-lg font-bold text-red-600">{formatCurrency(summary?.receivables_overdue || 0)}</p>
          <p className="text-xs text-gray-400">Posición neta: {formatCurrency(summary?.net_position || 0)}</p>
        </div>
      </div>

      {/* Receivables List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {/* Header with filters */}
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-gray-800">Cuentas por Cobrar</h3>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {filteredList.length} de {receivablesList.length}
              </span>
            </div>
            <button
              onClick={onCreateReceivable}
              className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-lg transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Nueva
            </button>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1">
            {filterTabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeFilter === tab.key;
              const count = tab.key === 'all'
                ? receivablesList.length
                : summaryByType[tab.key as keyof typeof summaryByType]?.count || 0;

              if (tab.key !== 'all' && count === 0) return null;

              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-100 text-brand-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {tab.label}
                  <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-xs ${
                    isActive ? 'bg-brand-200' : 'bg-gray-200'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Collapsible list */}
        <div>
          <button
            onClick={() => setIsListExpanded(!isListExpanded)}
            className="w-full px-4 py-2 flex items-center justify-between text-sm text-gray-600 hover:bg-gray-50"
          >
            <span>{isListExpanded ? 'Ocultar lista' : 'Mostrar lista'}</span>
            {isListExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {isListExpanded && (
            <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-100">
              {filteredList.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500">
                  <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm">No hay cuentas por cobrar {activeFilter !== 'all' ? 'de este tipo' : ''}</p>
                </div>
              ) : (
                filteredList.map((item) => {
                  const originInfo = getOriginInfo(item);
                  const OriginIcon = originInfo.icon;
                  const orderStatus = item.order_status ? getOrderStatusLabel(item.order_status) : null;

                  return (
                    <div key={item.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between gap-3">
                        {/* Left side - Compact details */}
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {/* Status indicator */}
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            item.is_paid ? 'bg-green-500' : item.is_overdue ? 'bg-red-500' : 'bg-orange-500'
                          }`} />

                          {/* Origin badge */}
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 ${originInfo.bgColor} ${originInfo.color}`}>
                            <OriginIcon className="w-3 h-3" />
                            {originInfo.label}
                          </span>

                          {/* Order status */}
                          {orderStatus && (
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 ${orderStatus.color}`}>
                              {orderStatus.label}
                            </span>
                          )}

                          {/* Client name or description */}
                          <span className="text-sm text-gray-700 truncate">
                            {item.client_name || item.description}
                          </span>

                          {/* School badge - compact */}
                          {item.school_name && (
                            <span className="hidden sm:inline px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded text-xs flex-shrink-0">
                              {item.school_name.length > 15 ? item.school_name.substring(0, 15) + '...' : item.school_name}
                            </span>
                          )}
                        </div>

                        {/* Right side - Amount and action */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="text-right">
                            <p className="text-sm font-semibold text-gray-800">{formatCurrency(item.balance)}</p>
                            {item.due_date && (
                              <p className={`text-xs ${item.is_overdue ? 'text-red-500' : 'text-gray-400'}`}>
                                {formatDate(item.due_date)}
                              </p>
                            )}
                          </div>
                          {!item.is_paid && (
                            <button
                              onClick={() => onPayReceivable(item)}
                              className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200 transition-colors"
                            >
                              Cobrar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AccountsReceivable;
