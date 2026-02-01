/**
 * FinancialStatements - Income Statement and Balance Sheet display
 */
import React, { useState, useCallback } from 'react';
import {
  Calculator, CheckCircle, Loader2, ChevronDown, ChevronRight,
  Save, Printer, Download, Info, History, Trash2, Eye, GitCompare
} from 'lucide-react';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { formatCurrency } from '../../utils/formatting';
import { useExpenseCategories } from '../../hooks/useExpenseCategories';
import { globalAccountingService } from '../../services/globalAccountingService';
import type { FinancialSnapshotItem } from '../../services/globalAccountingService';
import type { IncomeStatementResponse, BalanceSheetResponse, PeriodPreset } from './types';
import SnapshotIncomeStatement from './SnapshotIncomeStatement';
import SnapshotBalanceSheet from './SnapshotBalanceSheet';
import SnapshotComparison from './SnapshotComparison';

type StatementTab = 'income' | 'balance';

interface FinancialStatementsProps {
  activeStatementTab: StatementTab;
  onTabChange: (tab: StatementTab) => void;
  selectedPeriod: string;
  onPeriodChange: (period: string) => void;
  customStartDate: string;
  customEndDate: string;
  onCustomStartDateChange: (date: string) => void;
  onCustomEndDateChange: (date: string) => void;
  comparePrevious: boolean;
  onComparePreviousChange: (compare: boolean) => void;
  availablePeriods: PeriodPreset[];
  incomeStatement: IncomeStatementResponse | null;
  balanceSheet: BalanceSheetResponse | null;
  loadingStatements: boolean;
  statementsError: string | null;
  onGenerateIncomeStatement: () => void;
  onGenerateBalanceSheet: () => void;
}

const FinancialStatements: React.FC<FinancialStatementsProps> = ({
  activeStatementTab,
  onTabChange,
  selectedPeriod,
  onPeriodChange,
  customStartDate,
  customEndDate,
  onCustomStartDateChange,
  onCustomEndDateChange,
  comparePrevious,
  onComparePreviousChange,
  availablePeriods,
  incomeStatement,
  balanceSheet,
  loadingStatements,
  statementsError,
  onGenerateIncomeStatement,
  onGenerateBalanceSheet
}) => {
  const { getCategoryLabel } = useExpenseCategories();

  // Revenue breakdown expand state
  const [showRevenueBreakdown, setShowRevenueBreakdown] = useState(false);
  // Returns/discounts breakdown expand state
  const [showReturnsBreakdown, setShowReturnsBreakdown] = useState(false);
  // Other expenses breakdown expand state
  const [showOtherExpensesDetails, setShowOtherExpensesDetails] = useState(false);

  // Snapshot state
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [snapshots, setSnapshots] = useState<FinancialSnapshotItem[]>([]);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [viewingSnapshot, setViewingSnapshot] = useState<Record<string, unknown> | null>(null);
  const [viewingSnapshotMeta, setViewingSnapshotMeta] = useState<FinancialSnapshotItem | null>(null);

  // Comparison state
  const [comparisonMode, setComparisonMode] = useState(false);
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);
  const [comparisonData, setComparisonData] = useState<{
    a: { meta: FinancialSnapshotItem; data: Record<string, unknown> };
    b: { meta: FinancialSnapshotItem; data: Record<string, unknown> };
  } | null>(null);
  const [loadingComparison, setLoadingComparison] = useState(false);

  const handleGenerate = () => {
    if (activeStatementTab === 'income') {
      onGenerateIncomeStatement();
    } else {
      onGenerateBalanceSheet();
    }
  };

  const handleSaveSnapshot = useCallback(async () => {
    setSavingSnapshot(true);
    try {
      if (activeStatementTab === 'income' && incomeStatement) {
        await globalAccountingService.createFinancialSnapshot({
          snapshot_type: 'income_statement',
          snapshot_date: incomeStatement.period_end,
          period_start: incomeStatement.period_start,
          period_end: incomeStatement.period_end,
        });
      } else if (activeStatementTab === 'balance' && balanceSheet) {
        await globalAccountingService.createFinancialSnapshot({
          snapshot_type: 'balance_sheet',
          snapshot_date: balanceSheet.as_of_date,
        });
      }
      alert('Snapshot guardado exitosamente');
    } catch {
      alert('Error al guardar snapshot');
    } finally {
      setSavingSnapshot(false);
    }
  }, [activeStatementTab, incomeStatement, balanceSheet]);

  const handleLoadSnapshots = useCallback(async () => {
    setLoadingSnapshots(true);
    try {
      const type = activeStatementTab === 'income' ? 'income_statement' : 'balance_sheet';
      const data = await globalAccountingService.listFinancialSnapshots(type);
      setSnapshots(data);
      setShowSnapshots(true);
    } catch {
      alert('Error al cargar historial');
    } finally {
      setLoadingSnapshots(false);
    }
  }, [activeStatementTab]);

  const handleViewSnapshot = useCallback(async (snap: FinancialSnapshotItem) => {
    try {
      const full = await globalAccountingService.getFinancialSnapshot(snap.id);
      setViewingSnapshot(full.data);
      setViewingSnapshotMeta(snap);
    } catch {
      alert('Error al cargar snapshot');
    }
  }, []);

  const handleDeleteSnapshot = useCallback(async (id: string) => {
    if (!window.confirm('Eliminar este snapshot permanentemente?')) return;
    try {
      await globalAccountingService.deleteFinancialSnapshot(id);
      setSnapshots(prev => prev.filter(s => s.id !== id));
    } catch {
      alert('Error al eliminar snapshot');
    }
  }, []);

  const handleToggleComparison = useCallback((id: string) => {
    setSelectedForComparison(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  }, []);

  const handleCompare = useCallback(async () => {
    if (selectedForComparison.length !== 2) return;
    setLoadingComparison(true);
    try {
      const [fullA, fullB] = await Promise.all(
        selectedForComparison.map(id => globalAccountingService.getFinancialSnapshot(id))
      );
      const metaA = snapshots.find(s => s.id === selectedForComparison[0])!;
      const metaB = snapshots.find(s => s.id === selectedForComparison[1])!;
      setComparisonData({
        a: { meta: metaA, data: fullA.data },
        b: { meta: metaB, data: fullB.data },
      });
    } catch {
      alert('Error al cargar snapshots para comparar');
    } finally {
      setLoadingComparison(false);
    }
  }, [selectedForComparison, snapshots]);

  const handleExitComparisonMode = useCallback(() => {
    setComparisonMode(false);
    setSelectedForComparison([]);
    setComparisonData(null);
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = useCallback(async () => {
    const rows: string[][] = [];

    if (activeStatementTab === 'income' && incomeStatement) {
      rows.push(['Concepto', 'Monto']);
      rows.push(['Ventas Brutas', String(incomeStatement.gross_revenue)]);
      rows.push(['Devoluciones/Descuentos', String(incomeStatement.returns_discounts)]);
      rows.push(['Ingresos Netos', String(incomeStatement.net_revenue)]);
      rows.push(['Costo de Ventas', String(incomeStatement.cost_of_goods_sold)]);
      rows.push(['Utilidad Bruta', String(incomeStatement.gross_profit)]);
      for (const cat of incomeStatement.operating_expenses_by_category) {
        rows.push([`Gasto: ${getCategoryLabel(cat.category)}`, String(cat.total)]);
      }
      rows.push(['Total Gastos Operacionales', String(incomeStatement.total_operating_expenses)]);
      rows.push(['Utilidad Operacional', String(incomeStatement.operating_income)]);
      for (const cat of (incomeStatement.other_expenses_by_category || [])) {
        rows.push([`Otro Gasto: ${getCategoryLabel(cat.category)}`, String(cat.total)]);
      }
      rows.push(['Utilidad Neta', String(incomeStatement.net_income)]);
    } else if (activeStatementTab === 'balance' && balanceSheet) {
      rows.push(['Cuenta', 'Monto']);
      for (const acc of balanceSheet.current_assets.cash_accounts) {
        rows.push([acc.name, String(acc.balance)]);
      }
      rows.push(['Total Efectivo', String(balanceSheet.current_assets.total_cash)]);
      rows.push(['Cuentas por Cobrar', String(balanceSheet.current_assets.accounts_receivable)]);
      rows.push(['Inventario', String(balanceSheet.current_assets.total_inventory)]);
      rows.push(['Total Activos Corrientes', String(balanceSheet.total_current_assets)]);
      rows.push(['Total Activos Fijos', String(balanceSheet.total_fixed_assets)]);
      rows.push(['TOTAL ACTIVOS', String(balanceSheet.total_assets)]);
      rows.push(['Cuentas por Pagar', String(balanceSheet.current_liabilities.accounts_payable)]);
      rows.push(['Total Pasivos', String(balanceSheet.total_liabilities)]);
      rows.push(['Capital', String(balanceSheet.equity.capital)]);
      rows.push(['Utilidades Retenidas', String(balanceSheet.equity.retained_earnings)]);
      rows.push(['Utilidad del Ejercicio', String(balanceSheet.equity.current_period_earnings)]);
      rows.push(['Total Patrimonio', String(balanceSheet.total_equity)]);
      rows.push(['Patrimonio Neto', String(balanceSheet.net_worth)]);
    }

    if (rows.length === 0) return;

    const csv = '\uFEFF' + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const defaultName = `${activeStatementTab === 'income' ? 'estado_resultados' : 'balance_general'}_${new Date().toISOString().split('T')[0]}.csv`;

    try {
      // Try Tauri native save dialog
      const filePath = await save({
        defaultPath: defaultName,
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      });

      if (filePath) {
        const encoder = new TextEncoder();
        await writeFile(filePath, encoder.encode(csv));
        alert('CSV exportado exitosamente');
      }
    } catch {
      // Fallback for browser/dev mode
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = defaultName;
      link.click();
      URL.revokeObjectURL(url);
    }
  }, [activeStatementTab, incomeStatement, balanceSheet, getCategoryLabel]);

  return (
    <>
      {/* Period Selection */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Estados Financieros</h3>

        {/* Statement Type Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => onTabChange('income')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeStatementTab === 'income'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Estado de Resultados
          </button>
          <button
            onClick={() => onTabChange('balance')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeStatementTab === 'balance'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Balance General
          </button>
        </div>

        {/* Period Filters for Income Statement */}
        {activeStatementTab === 'income' && (
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Periodo</label>
              <select
                value={selectedPeriod}
                onChange={(e) => onPeriodChange(e.target.value)}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                {availablePeriods.map((period) => (
                  <option key={period.key} value={period.key}>{period.label}</option>
                ))}
                <option value="custom">Personalizado</option>
              </select>
            </div>

            {selectedPeriod === 'custom' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => onCustomStartDateChange(e.target.value)}
                    className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => onCustomEndDateChange(e.target.value)}
                    className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </>
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="comparePrevious"
                checked={comparePrevious}
                onChange={(e) => onComparePreviousChange(e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="comparePrevious" className="text-sm text-gray-600">
                Comparar con periodo anterior
              </label>
            </div>

            <button
              onClick={handleGenerate}
              disabled={loadingStatements}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loadingStatements && <Loader2 className="w-4 h-4 animate-spin" />}
              Generar
            </button>
          </div>
        )}

        {/* Period Filter for Balance Sheet */}
        {activeStatementTab === 'balance' && (
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de corte</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => onCustomEndDateChange(e.target.value)}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              onClick={handleGenerate}
              disabled={loadingStatements}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loadingStatements && <Loader2 className="w-4 h-4 animate-spin" />}
              Generar
            </button>
          </div>
        )}

        {/* Error Display */}
        {statementsError && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
            {statementsError}
          </div>
        )}
      </div>

      {/* Loading State */}
      {loadingStatements && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <span className="ml-3 text-gray-600">Generando estado financiero...</span>
        </div>
      )}

      {/* Income Statement Display */}
      {activeStatementTab === 'income' && incomeStatement && !loadingStatements && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h4 className="text-lg font-bold text-gray-800">ESTADO DE RESULTADOS</h4>
              <p className="text-sm text-gray-500">
                Periodo: {new Date(incomeStatement.period_start).toLocaleDateString('es-CO')} - {new Date(incomeStatement.period_end).toLocaleDateString('es-CO')}
              </p>
            </div>
            <div className="flex gap-2 print:hidden">
              <button
                onClick={handleSaveSnapshot}
                disabled={savingSnapshot}
                className="px-3 py-1.5 text-xs bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 flex items-center gap-1"
                title="Guardar snapshot"
              >
                {savingSnapshot ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Guardar
              </button>
              <button
                onClick={handlePrint}
                className="px-3 py-1.5 text-xs bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 flex items-center gap-1"
                title="Imprimir / PDF"
              >
                <Printer className="w-3 h-3" /> Imprimir
              </button>
              <button
                onClick={handleExportCSV}
                className="px-3 py-1.5 text-xs bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 flex items-center gap-1"
                title="Exportar CSV"
              >
                <Download className="w-3 h-3" /> CSV
              </button>
              <button
                onClick={handleLoadSnapshots}
                disabled={loadingSnapshots}
                className="px-3 py-1.5 text-xs bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 flex items-center gap-1"
                title="Ver historial"
              >
                {loadingSnapshots ? <Loader2 className="w-3 h-3 animate-spin" /> : <History className="w-3 h-3" />}
                Historial
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {/* Revenue Section */}
            <div className="border-b pb-4">
              <div className="flex justify-between items-center py-1">
                <button
                  onClick={() => setShowRevenueBreakdown(!showRevenueBreakdown)}
                  className="flex items-center gap-1 text-gray-700 hover:text-indigo-600 transition-colors"
                >
                  {showRevenueBreakdown ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  (+) Ventas Brutas ({incomeStatement.sales_count} ventas)
                </button>
                <span className="font-medium text-green-600">{formatCurrency(incomeStatement.gross_revenue)}</span>
              </div>

              {/* Revenue Breakdown by School */}
              {showRevenueBreakdown && incomeStatement.revenue_breakdown && (
                <div className="ml-6 mt-1 mb-2 space-y-1">
                  {incomeStatement.revenue_breakdown.by_school.map((school) => (
                    <div key={school.school_id} className="flex justify-between text-sm text-gray-500">
                      <span>{school.school_name} ({school.count} ventas)</span>
                      <span>{formatCurrency(school.total)}</span>
                    </div>
                  ))}
                  {incomeStatement.revenue_breakdown.global_products.total > 0 && (
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Productos Globales ({incomeStatement.revenue_breakdown.global_products.count} items)</span>
                      <span>{formatCurrency(incomeStatement.revenue_breakdown.global_products.total)}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between items-center py-1 text-gray-500 text-sm">
                <button
                  onClick={() => setShowReturnsBreakdown(!showReturnsBreakdown)}
                  className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                >
                  {showReturnsBreakdown ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  (-) Devoluciones/Descuentos
                </button>
                <span>{formatCurrency(incomeStatement.returns_discounts)}</span>
              </div>

              {/* Returns/Discounts Breakdown */}
              {showReturnsBreakdown && incomeStatement.returns_discounts_breakdown && (
                <div className="ml-6 mt-1 mb-2 space-y-1">
                  {incomeStatement.returns_discounts_breakdown.discounts > 0 && (
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Descuentos ({incomeStatement.returns_discounts_breakdown.discounts_count})</span>
                      <span>{formatCurrency(incomeStatement.returns_discounts_breakdown.discounts)}</span>
                    </div>
                  )}
                  {incomeStatement.returns_discounts_breakdown.sale_returns > 0 && (
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Cambios/Devoluciones ({incomeStatement.returns_discounts_breakdown.sale_returns_count})</span>
                      <span>{formatCurrency(incomeStatement.returns_discounts_breakdown.sale_returns)}</span>
                    </div>
                  )}
                  {incomeStatement.returns_discounts_breakdown.discounts === 0 &&
                   incomeStatement.returns_discounts_breakdown.sale_returns === 0 && (
                    <div className="text-sm text-gray-400 italic">Sin devoluciones ni descuentos en este periodo</div>
                  )}
                </div>
              )}
              <div className="flex justify-between items-center py-2 font-semibold border-t mt-2">
                <span>= INGRESOS NETOS</span>
                <span className="text-green-700">{formatCurrency(incomeStatement.net_revenue)}</span>
              </div>
            </div>

            {/* COGS Section */}
            <div className="border-b pb-4">
              <div className="flex justify-between items-center py-1">
                <span className="text-gray-700">(-) Costo de Ventas</span>
                <span className="font-medium text-red-600">{formatCurrency(incomeStatement.cost_of_goods_sold)}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                ({incomeStatement.cogs_coverage_percent.toFixed(0)}% con costo real, {(100 - incomeStatement.cogs_coverage_percent).toFixed(0)}% estimado)
              </p>
              <div className="flex justify-between items-center py-2 font-semibold border-t mt-2">
                <span>= UTILIDAD BRUTA</span>
                <span className={incomeStatement.gross_profit >= 0 ? 'text-green-700' : 'text-red-700'}>
                  {formatCurrency(incomeStatement.gross_profit)}
                </span>
              </div>
              <p className="text-xs text-gray-500">Margen Bruto: {incomeStatement.gross_margin_percent.toFixed(1)}%</p>
            </div>

            {/* Operating Expenses */}
            <div className="border-b pb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">GASTOS OPERACIONALES</p>
              {incomeStatement.operating_expenses_by_category.map((cat) => (
                <div key={cat.category} className="flex justify-between text-sm py-1">
                  <span className="text-gray-600">
                    (-) {getCategoryLabel(cat.category)}
                    {cat.percentage_of_revenue > 0 && (
                      <span className="text-gray-400 ml-1 text-xs">
                        ({cat.percentage_of_revenue.toFixed(1)}%)
                      </span>
                    )}
                  </span>
                  <span className="text-red-500">{formatCurrency(cat.total)}</span>
                </div>
              ))}
              {incomeStatement.operating_expenses_by_category.length === 0 && (
                <p className="text-sm text-gray-400 italic py-1">Sin gastos operacionales en este periodo</p>
              )}
              <div className="flex justify-between items-center py-2 font-semibold border-t mt-2">
                <span>= UTILIDAD OPERACIONAL</span>
                <span className={incomeStatement.operating_income >= 0 ? 'text-green-700' : 'text-red-700'}>
                  {formatCurrency(incomeStatement.operating_income)}
                </span>
              </div>
              <p className="text-xs text-gray-500">Margen Operacional: {incomeStatement.operating_margin_percent.toFixed(1)}%</p>
            </div>

            {/* Other Expenses */}
            <div className="border-b pb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">OTROS GASTOS</p>
              {(incomeStatement.other_expenses_by_category || []).map((cat) => (
                <div key={cat.category}>
                  <div className="flex justify-between text-sm py-1">
                    {cat.category === 'other' && incomeStatement.other_expenses_details && incomeStatement.other_expenses_details.length > 0 ? (
                      <button
                        onClick={() => setShowOtherExpensesDetails(!showOtherExpensesDetails)}
                        className="flex items-center gap-1 text-gray-600 hover:text-gray-800 transition-colors"
                      >
                        {showOtherExpensesDetails ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        (-) {getCategoryLabel(cat.category)}
                      </button>
                    ) : (
                      <span className="text-gray-600">
                        (-) {getCategoryLabel(cat.category)}
                      </span>
                    )}
                    <span className="text-red-500">{formatCurrency(cat.total)}</span>
                  </div>
                  {/* Desglose de gastos "Otros" */}
                  {cat.category === 'other' && showOtherExpensesDetails && incomeStatement.other_expenses_details && (
                    <div className="ml-6 mt-1 mb-2 space-y-1 max-h-60 overflow-y-auto">
                      {incomeStatement.other_expenses_details.map((expense) => (
                        <div key={expense.id} className="flex justify-between text-xs text-gray-500 py-0.5">
                          <span className="truncate max-w-[200px]" title={expense.description}>
                            {expense.date.split('-').reverse().join('/')} - {expense.description || 'Sin descripción'}
                          </span>
                          <span className="text-red-400 ml-2 whitespace-nowrap">{formatCurrency(expense.amount)}</span>
                        </div>
                      ))}
                      {incomeStatement.other_expenses_details.length >= 50 && (
                        <p className="text-xs text-gray-400 italic pt-1">Mostrando los 50 gastos más altos</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {/* Fallback: if backend hasn't been updated yet, show legacy fields */}
              {!incomeStatement.other_expenses_by_category && incomeStatement.other_expenses.total > 0 && (
                <>
                  {incomeStatement.other_expenses.taxes > 0 && (
                    <div className="flex justify-between text-sm py-1">
                      <span className="text-gray-600">(-) {getCategoryLabel('taxes')}</span>
                      <span className="text-red-500">{formatCurrency(incomeStatement.other_expenses.taxes)}</span>
                    </div>
                  )}
                  {incomeStatement.other_expenses.bank_fees > 0 && (
                    <div className="flex justify-between text-sm py-1">
                      <span className="text-gray-600">(-) {getCategoryLabel('bank_fees')}</span>
                      <span className="text-red-500">{formatCurrency(incomeStatement.other_expenses.bank_fees)}</span>
                    </div>
                  )}
                  {incomeStatement.other_expenses.other > 0 && (
                    <div className="flex justify-between text-sm py-1">
                      <span className="text-gray-600">(-) {getCategoryLabel('other')}</span>
                      <span className="text-red-500">{formatCurrency(incomeStatement.other_expenses.other)}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Net Income */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-gray-800">UTILIDAD NETA</span>
                <span className={`text-2xl font-bold ${incomeStatement.net_income >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(incomeStatement.net_income)}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">Margen Neto: {incomeStatement.net_margin_percent.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Balance Sheet Display */}
      {activeStatementTab === 'balance' && balanceSheet && !loadingStatements && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h4 className="text-lg font-bold text-gray-800">BALANCE GENERAL</h4>
              <p className="text-sm text-gray-500">
                Al: {new Date(balanceSheet.as_of_date).toLocaleDateString('es-CO')}
              </p>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              {balanceSheet.is_balanced ? (
                <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Balance Cuadrado
                </span>
              ) : (
                <span className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded">
                  Diferencia: {formatCurrency(balanceSheet.balance_difference)}
                </span>
              )}
              <button
                onClick={handleSaveSnapshot}
                disabled={savingSnapshot}
                className="px-3 py-1.5 text-xs bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 flex items-center gap-1"
              >
                {savingSnapshot ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Guardar
              </button>
              <button onClick={handlePrint} className="px-3 py-1.5 text-xs bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 flex items-center gap-1">
                <Printer className="w-3 h-3" /> Imprimir
              </button>
              <button onClick={handleExportCSV} className="px-3 py-1.5 text-xs bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 flex items-center gap-1">
                <Download className="w-3 h-3" /> CSV
              </button>
              <button
                onClick={handleLoadSnapshots}
                disabled={loadingSnapshots}
                className="px-3 py-1.5 text-xs bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 flex items-center gap-1"
              >
                {loadingSnapshots ? <Loader2 className="w-3 h-3 animate-spin" /> : <History className="w-3 h-3" />}
                Historial
              </button>
            </div>
          </div>

          {/* Historical Note */}
          {balanceSheet.historical_note && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 text-sm text-amber-800 print:hidden">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{balanceSheet.historical_note}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ACTIVOS */}
            <div>
              <h5 className="font-bold text-gray-800 border-b-2 border-gray-800 pb-2 mb-3">ACTIVOS</h5>

              {/* Activos Corrientes */}
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-600 mb-2">Corrientes</p>
                <div className="space-y-1 text-sm">
                  {balanceSheet.current_assets.cash_accounts.map((acc) => (
                    <div key={acc.id} className="flex justify-between">
                      <span className="text-gray-600">{acc.name}</span>
                      <span>{formatCurrency(acc.balance)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-gray-500 border-t pt-1">
                    <span>Total Efectivo</span>
                    <span>{formatCurrency(balanceSheet.current_assets.total_cash)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cuentas por Cobrar ({balanceSheet.current_assets.accounts_receivable_count})</span>
                    <span>{formatCurrency(balanceSheet.current_assets.accounts_receivable)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Inventario ({balanceSheet.current_assets.inventory.total_units} uds)</span>
                    <span>{formatCurrency(balanceSheet.current_assets.total_inventory)}</span>
                  </div>
                </div>
                <div className="flex justify-between font-medium border-t mt-2 pt-2">
                  <span>TOTAL ACTIVOS CORRIENTES</span>
                  <span>{formatCurrency(balanceSheet.total_current_assets)}</span>
                </div>
              </div>

              {/* Activos Fijos */}
              {balanceSheet.fixed_assets.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-600 mb-2">Fijos</p>
                  <div className="space-y-1 text-sm">
                    {balanceSheet.fixed_assets.map((acc) => (
                      <div key={acc.id} className="flex justify-between">
                        <span className="text-gray-600">{acc.name}</span>
                        <span>{formatCurrency(acc.net_value)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between font-medium border-t mt-2 pt-2">
                    <span>TOTAL ACTIVOS FIJOS</span>
                    <span>{formatCurrency(balanceSheet.total_fixed_assets)}</span>
                  </div>
                </div>
              )}

              {/* Total Activos */}
              <div className="flex justify-between font-bold text-lg border-t-2 border-gray-800 pt-2 mt-4">
                <span>TOTAL ACTIVOS</span>
                <span className="text-blue-600">{formatCurrency(balanceSheet.total_assets)}</span>
              </div>
            </div>

            {/* PASIVOS Y PATRIMONIO */}
            <div>
              <h5 className="font-bold text-gray-800 border-b-2 border-gray-800 pb-2 mb-3">PASIVOS</h5>

              {/* Pasivos Corrientes */}
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-600 mb-2">Corrientes</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cuentas por Pagar ({balanceSheet.current_liabilities.accounts_payable_count})</span>
                    <span>{formatCurrency(balanceSheet.current_liabilities.accounts_payable)}</span>
                  </div>
                  {balanceSheet.current_liabilities.pending_expenses > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Gastos Pendientes ({balanceSheet.current_liabilities.pending_expenses_count})</span>
                      <span>{formatCurrency(balanceSheet.current_liabilities.pending_expenses)}</span>
                    </div>
                  )}
                  {balanceSheet.current_liabilities.short_term_debt.map((acc) => (
                    <div key={acc.id} className="flex justify-between">
                      <span className="text-gray-600">{acc.name}</span>
                      <span>{formatCurrency(acc.balance)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between font-medium border-t mt-2 pt-2">
                  <span>TOTAL PASIVOS CORRIENTES</span>
                  <span>{formatCurrency(balanceSheet.total_current_liabilities)}</span>
                </div>
              </div>

              {/* Pasivos Largo Plazo */}
              {balanceSheet.long_term_liabilities.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-600 mb-2">Largo Plazo</p>
                  <div className="space-y-1 text-sm">
                    {balanceSheet.long_term_liabilities.map((acc) => (
                      <div key={acc.id} className="flex justify-between">
                        <span className="text-gray-600">{acc.name}</span>
                        <span>{formatCurrency(acc.balance)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between font-medium border-t mt-2 pt-2">
                    <span>TOTAL PASIVOS LARGO PLAZO</span>
                    <span>{formatCurrency(balanceSheet.total_long_term_liabilities)}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-between font-bold border-t pt-2">
                <span>TOTAL PASIVOS</span>
                <span className="text-red-600">{formatCurrency(balanceSheet.total_liabilities)}</span>
              </div>

              {/* Patrimonio */}
              <h5 className="font-bold text-gray-800 border-b-2 border-gray-800 pb-2 mb-3 mt-6">PATRIMONIO</h5>
              <div className="space-y-1 text-sm mb-4">
                {balanceSheet.equity.capital > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Capital</span>
                    <span>{formatCurrency(balanceSheet.equity.capital)}</span>
                  </div>
                )}
                {balanceSheet.equity.retained_earnings !== 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Utilidades Retenidas</span>
                    <span>{formatCurrency(balanceSheet.equity.retained_earnings)}</span>
                  </div>
                )}
                {balanceSheet.equity.current_period_earnings !== undefined && balanceSheet.equity.current_period_earnings !== 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Utilidad del Ejercicio</span>
                    <span className={balanceSheet.equity.current_period_earnings >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {formatCurrency(balanceSheet.equity.current_period_earnings)}
                    </span>
                  </div>
                )}
                {balanceSheet.equity.other_equity !== 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Otros</span>
                    <span>{formatCurrency(balanceSheet.equity.other_equity)}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between font-bold border-t pt-2">
                <span>TOTAL PATRIMONIO</span>
                <span className="text-green-600">{formatCurrency(balanceSheet.total_equity)}</span>
              </div>

              {/* Total Pasivos + Patrimonio */}
              <div className="flex justify-between font-bold text-lg border-t-2 border-gray-800 pt-2 mt-4">
                <span>PASIVOS + PATRIMONIO</span>
                <span className="text-blue-600">{formatCurrency(balanceSheet.total_liabilities + balanceSheet.total_equity)}</span>
              </div>
            </div>
          </div>

          {/* Net Worth Summary */}
          <div className="mt-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold text-gray-800">PATRIMONIO NETO</span>
              <span className={`text-2xl font-bold ${balanceSheet.net_worth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(balanceSheet.net_worth)}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">Activos - Pasivos</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {activeStatementTab === 'income' && !incomeStatement && !loadingStatements && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Calculator className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Selecciona un periodo y haz clic en "Generar" para ver el Estado de Resultados</p>
        </div>
      )}

      {activeStatementTab === 'balance' && !balanceSheet && !loadingStatements && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Calculator className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Haz clic en "Generar" para ver el Balance General</p>
        </div>
      )}

      {/* Snapshot History Panel */}
      {showSnapshots && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6 print:hidden">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <History className="w-5 h-5" />
              Historial de Snapshots
            </h4>
            <div className="flex items-center gap-2">
              {snapshots.length >= 2 && (
                <button
                  onClick={() => comparisonMode ? handleExitComparisonMode() : setComparisonMode(true)}
                  className={`px-3 py-1.5 text-xs rounded-lg flex items-center gap-1 ${
                    comparisonMode
                      ? 'bg-indigo-600 text-white'
                      : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                  }`}
                >
                  <GitCompare className="w-3 h-3" />
                  {comparisonMode ? 'Cancelar' : 'Comparar'}
                </button>
              )}
              <button
                onClick={() => { setShowSnapshots(false); setViewingSnapshot(null); setViewingSnapshotMeta(null); handleExitComparisonMode(); }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Cerrar
              </button>
            </div>
          </div>

          {comparisonMode && (
            <div className="mb-3 bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm text-indigo-700">
              Selecciona 2 snapshots para comparar ({selectedForComparison.length}/2)
              {selectedForComparison.length === 2 && (
                <button
                  onClick={handleCompare}
                  disabled={loadingComparison}
                  className="ml-3 px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center gap-1"
                >
                  {loadingComparison && <Loader2 className="w-3 h-3 animate-spin" />}
                  Ver Comparacion
                </button>
              )}
            </div>
          )}

          {snapshots.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">No hay snapshots guardados</p>
          ) : (
            <div className="space-y-2">
              {snapshots.map((snap) => (
                <div key={snap.id} className={`flex items-center justify-between rounded-lg p-3 ${
                  selectedForComparison.includes(snap.id) ? 'bg-indigo-50 border border-indigo-200' : 'bg-gray-50'
                }`}>
                  <div className="flex items-center gap-3">
                    {comparisonMode && (
                      <input
                        type="checkbox"
                        checked={selectedForComparison.includes(snap.id)}
                        onChange={() => handleToggleComparison(snap.id)}
                        disabled={!selectedForComparison.includes(snap.id) && selectedForComparison.length >= 2}
                        className="rounded border-gray-300 text-indigo-600"
                      />
                    )}
                    <div>
                      <span className="text-sm font-medium text-gray-700">
                        {snap.snapshot_type === 'income_statement' ? 'Estado de Resultados' : 'Balance General'}
                      </span>
                      <span className="text-sm text-gray-500 ml-2">
                        {snap.period_start && snap.period_end
                          ? `${new Date(snap.period_start).toLocaleDateString('es-CO')} - ${new Date(snap.period_end).toLocaleDateString('es-CO')}`
                          : new Date(snap.snapshot_date).toLocaleDateString('es-CO')
                        }
                      </span>
                      <span className="text-xs text-gray-400 ml-2">
                        Guardado: {new Date(snap.created_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}
                      </span>
                      {snap.notes && <span className="text-xs text-indigo-500 ml-2">{snap.notes}</span>}
                    </div>
                  </div>
                  {!comparisonMode && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleViewSnapshot(snap)}
                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"
                        title="Ver"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteSnapshot(snap.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Viewing a snapshot (formatted) */}
          {viewingSnapshot && viewingSnapshotMeta && !comparisonMode && (
            <div className="mt-4 border-t pt-4">
              <div className="flex justify-between items-center mb-3">
                <h5 className="text-sm font-semibold text-gray-700">
                  Snapshot: {viewingSnapshotMeta.snapshot_type === 'income_statement' ? 'Estado de Resultados' : 'Balance General'} —{' '}
                  {viewingSnapshotMeta.period_start && viewingSnapshotMeta.period_end
                    ? `${new Date(viewingSnapshotMeta.period_start).toLocaleDateString('es-CO')} - ${new Date(viewingSnapshotMeta.period_end).toLocaleDateString('es-CO')}`
                    : new Date(viewingSnapshotMeta.snapshot_date).toLocaleDateString('es-CO')
                  }
                </h5>
                <button
                  onClick={() => { setViewingSnapshot(null); setViewingSnapshotMeta(null); }}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Cerrar vista
                </button>
              </div>
              {viewingSnapshotMeta.snapshot_type === 'income_statement' ? (
                <SnapshotIncomeStatement data={viewingSnapshot} getCategoryLabel={getCategoryLabel} />
              ) : (
                <SnapshotBalanceSheet data={viewingSnapshot} />
              )}
            </div>
          )}

          {/* Comparison view */}
          {comparisonData && (
            <SnapshotComparison
              snapshotType={comparisonData.a.meta.snapshot_type}
              snapshotA={comparisonData.a}
              snapshotB={comparisonData.b}
              onClose={() => setComparisonData(null)}
            />
          )}
        </div>
      )}
    </>
  );
};

export default FinancialStatements;
