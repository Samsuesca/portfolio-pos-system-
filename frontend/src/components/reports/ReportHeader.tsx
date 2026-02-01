/**
 * ReportHeader Component - Tab navigation + date filters
 */
import React from 'react';
import {
  ShoppingBag, Wallet, ScrollText, Scissors, Package, BarChart3,
  Filter, Calendar, TrendingUp
} from 'lucide-react';
import DatePicker from '../DatePicker';
import { type ReportTab, type DatePreset, type DateFilters, formatDateDisplay } from './types';

interface ReportHeaderProps {
  activeTab: ReportTab;
  onTabChange: (tab: ReportTab) => void;
  datePreset: DatePreset;
  onPresetChange: (preset: DatePreset) => void;
  customStartDate: string;
  customEndDate: string;
  onCustomStartDateChange: (date: string) => void;
  onCustomEndDateChange: (date: string) => void;
  onApplyCustomDates: () => void;
  activeFilters: DateFilters;
}

const TABS = [
  { key: 'sales' as ReportTab, label: 'Ventas', icon: ShoppingBag, color: 'blue' },
  { key: 'profitability' as ReportTab, label: 'Rentabilidad', icon: TrendingUp, color: 'emerald' },
  { key: 'financial' as ReportTab, label: 'Financiero Global', icon: Wallet, color: 'green' },
  { key: 'movements' as ReportTab, label: 'Log de Movimientos', icon: ScrollText, color: 'purple' },
  { key: 'alterations' as ReportTab, label: 'Arreglos', icon: Scissors, color: 'orange' },
  { key: 'inventory' as ReportTab, label: 'Mov. Inventario', icon: Package, color: 'teal' },
  { key: 'analysis' as ReportTab, label: 'Analisis Mensual', icon: BarChart3, color: 'indigo' },
];

const DATE_PRESETS = [
  { value: 'today' as DatePreset, label: 'Hoy' },
  { value: 'week' as DatePreset, label: 'Semana' },
  { value: 'month' as DatePreset, label: 'Este Mes' },
  { value: 'year' as DatePreset, label: 'Este Ano' },
  { value: 'all' as DatePreset, label: 'Todo' },
  { value: 'custom' as DatePreset, label: 'Personalizado' },
];

const ReportHeader: React.FC<ReportHeaderProps> = ({
  activeTab,
  onTabChange,
  datePreset,
  onPresetChange,
  customStartDate,
  customEndDate,
  onCustomStartDateChange,
  onCustomEndDateChange,
  onApplyCustomDates,
  activeFilters
}) => {
  const getDateRangeLabel = (): string => {
    if (datePreset === 'all') return 'Todo el tiempo';
    if (!activeFilters.startDate || !activeFilters.endDate) return '';
    if (activeFilters.startDate === activeFilters.endDate) {
      return formatDateDisplay(activeFilters.startDate);
    }
    return `${formatDateDisplay(activeFilters.startDate)} - ${formatDateDisplay(activeFilters.endDate)}`;
  };

  const getTabClasses = (tab: typeof TABS[0]) => {
    const isActive = activeTab === tab.key;
    const colorMap: Record<string, string> = {
      blue: 'border-blue-600 text-blue-600',
      emerald: 'border-emerald-600 text-emerald-600',
      green: 'border-green-600 text-green-600',
      purple: 'border-purple-600 text-purple-600',
      orange: 'border-orange-600 text-orange-600',
      teal: 'border-teal-600 text-teal-600',
      indigo: 'border-indigo-600 text-indigo-600'
    };

    return isActive
      ? colorMap[tab.color]
      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300';
  };

  return (
    <>
      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex gap-4">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                className={`pb-3 px-1 text-sm font-medium border-b-2 transition ${getTabClasses(tab)}`}
              >
                <Icon className="w-4 h-4 inline mr-2" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Date Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Periodo:</span>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap gap-2">
            {DATE_PRESETS.map((option) => (
              <button
                key={option.value}
                onClick={() => onPresetChange(option.value)}
                className={`px-3 py-1.5 text-sm rounded-lg transition ${
                  datePreset === option.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Custom Date Range */}
          {datePreset === 'custom' && (
            <div className="flex flex-wrap items-center gap-2 ml-0 lg:ml-4 pt-2 lg:pt-0 border-t lg:border-t-0 lg:border-l border-gray-200 lg:pl-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <DatePicker
                  value={customStartDate}
                  onChange={onCustomStartDateChange}
                  placeholder="Desde"
                  className="w-36"
                />
                <span className="text-gray-500">a</span>
                <DatePicker
                  value={customEndDate}
                  onChange={onCustomEndDateChange}
                  placeholder="Hasta"
                  minDate={customStartDate}
                  className="w-36"
                />
              </div>
              <button
                onClick={onApplyCustomDates}
                disabled={!customStartDate || !customEndDate}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Aplicar
              </button>
            </div>
          )}
        </div>

        {/* Active Date Range Display */}
        {getDateRangeLabel() && (
          <div className="mt-3 text-sm text-gray-600 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>Mostrando datos de: <strong>{getDateRangeLabel()}</strong></span>
          </div>
        )}
      </div>
    </>
  );
};

export default ReportHeader;
