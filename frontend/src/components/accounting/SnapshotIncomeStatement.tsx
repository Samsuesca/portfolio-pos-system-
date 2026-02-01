/**
 * SnapshotIncomeStatement - Renders a saved Income Statement snapshot
 * with proper formatting (not raw JSON)
 */
import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { formatCurrency } from '../../utils/formatting';

interface SnapshotIncomeStatementProps {
  data: Record<string, unknown>;
  getCategoryLabel: (code: string) => string;
}

// Safe accessors for snapshot data (may be from older versions)
const num = (val: unknown): number => (typeof val === 'number' ? val : 0);
const str = (val: unknown): string => (typeof val === 'string' ? val : '');
const arr = (val: unknown): Record<string, unknown>[] =>
  Array.isArray(val) ? val : [];

const SnapshotIncomeStatement: React.FC<SnapshotIncomeStatementProps> = ({ data, getCategoryLabel }) => {
  const [showBreakdown, setShowBreakdown] = useState(false);

  const breakdown = data.revenue_breakdown as Record<string, unknown> | undefined;
  const bySchool = breakdown ? arr(breakdown.by_school) : [];
  const globalProducts = breakdown?.global_products as Record<string, unknown> | undefined;

  const operatingExpenses = arr(data.operating_expenses_by_category);
  const otherExpenses = arr(data.other_expenses_by_category);
  const legacyOther = data.other_expenses as Record<string, unknown> | undefined;

  return (
    <div className="space-y-4">
      {/* Revenue Section */}
      <div className="border-b pb-4">
        <div className="flex justify-between items-center py-1">
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="flex items-center gap-1 text-gray-700 hover:text-indigo-600 transition-colors"
          >
            {showBreakdown ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            (+) Ventas Brutas ({num(data.sales_count)} ventas)
          </button>
          <span className="font-medium text-green-600">{formatCurrency(num(data.gross_revenue))}</span>
        </div>

        {showBreakdown && bySchool.length > 0 && (
          <div className="ml-6 mt-1 mb-2 space-y-1">
            {bySchool.map((school, i) => (
              <div key={str(school.school_id) || i} className="flex justify-between text-sm text-gray-500">
                <span>{str(school.school_name)} ({num(school.count)} ventas)</span>
                <span>{formatCurrency(num(school.total))}</span>
              </div>
            ))}
            {globalProducts && num(globalProducts.total) > 0 && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>Productos Globales ({num(globalProducts.count)} items)</span>
                <span>{formatCurrency(num(globalProducts.total))}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between items-center py-1 text-gray-500 text-sm">
          <span>(-) Devoluciones/Descuentos</span>
          <span>{formatCurrency(num(data.returns_discounts))}</span>
        </div>
        <div className="flex justify-between items-center py-2 font-semibold border-t mt-2">
          <span>= INGRESOS NETOS</span>
          <span className="text-green-700">{formatCurrency(num(data.net_revenue))}</span>
        </div>
      </div>

      {/* COGS Section */}
      <div className="border-b pb-4">
        <div className="flex justify-between items-center py-1">
          <span className="text-gray-700">(-) Costo de Ventas</span>
          <span className="font-medium text-red-600">{formatCurrency(num(data.cost_of_goods_sold))}</span>
        </div>
        {num(data.cogs_coverage_percent) > 0 && (
          <p className="text-xs text-gray-400 mt-1">
            ({num(data.cogs_coverage_percent).toFixed(0)}% con costo real, {(100 - num(data.cogs_coverage_percent)).toFixed(0)}% estimado)
          </p>
        )}
        <div className="flex justify-between items-center py-2 font-semibold border-t mt-2">
          <span>= UTILIDAD BRUTA</span>
          <span className={num(data.gross_profit) >= 0 ? 'text-green-700' : 'text-red-700'}>
            {formatCurrency(num(data.gross_profit))}
          </span>
        </div>
        <p className="text-xs text-gray-500">Margen Bruto: {num(data.gross_margin_percent).toFixed(1)}%</p>
      </div>

      {/* Operating Expenses */}
      <div className="border-b pb-4">
        <p className="text-sm font-medium text-gray-700 mb-2">GASTOS OPERACIONALES</p>
        {operatingExpenses.map((cat, i) => (
          <div key={str(cat.category) || i} className="flex justify-between text-sm py-1">
            <span className="text-gray-600">
              (-) {getCategoryLabel(str(cat.category))}
              {num(cat.percentage_of_revenue) > 0 && (
                <span className="text-gray-400 ml-1 text-xs">
                  ({num(cat.percentage_of_revenue).toFixed(1)}%)
                </span>
              )}
            </span>
            <span className="text-red-500">{formatCurrency(num(cat.total))}</span>
          </div>
        ))}
        {operatingExpenses.length === 0 && (
          <p className="text-sm text-gray-400 italic py-1">Sin gastos operacionales en este periodo</p>
        )}
        <div className="flex justify-between items-center py-2 font-semibold border-t mt-2">
          <span>= UTILIDAD OPERACIONAL</span>
          <span className={num(data.operating_income) >= 0 ? 'text-green-700' : 'text-red-700'}>
            {formatCurrency(num(data.operating_income))}
          </span>
        </div>
        <p className="text-xs text-gray-500">Margen Operacional: {num(data.operating_margin_percent).toFixed(1)}%</p>
      </div>

      {/* Other Expenses */}
      <div className="border-b pb-4">
        <p className="text-sm font-medium text-gray-700 mb-2">OTROS GASTOS</p>
        {otherExpenses.map((cat, i) => (
          <div key={str(cat.category) || i} className="flex justify-between text-sm py-1">
            <span className="text-gray-600">(-) {getCategoryLabel(str(cat.category))}</span>
            <span className="text-red-500">{formatCurrency(num(cat.total))}</span>
          </div>
        ))}
        {otherExpenses.length === 0 && legacyOther && num(legacyOther.total) > 0 && (
          <>
            {num(legacyOther.taxes) > 0 && (
              <div className="flex justify-between text-sm py-1">
                <span className="text-gray-600">(-) {getCategoryLabel('taxes')}</span>
                <span className="text-red-500">{formatCurrency(num(legacyOther.taxes))}</span>
              </div>
            )}
            {num(legacyOther.bank_fees) > 0 && (
              <div className="flex justify-between text-sm py-1">
                <span className="text-gray-600">(-) {getCategoryLabel('bank_fees')}</span>
                <span className="text-red-500">{formatCurrency(num(legacyOther.bank_fees))}</span>
              </div>
            )}
            {num(legacyOther.other) > 0 && (
              <div className="flex justify-between text-sm py-1">
                <span className="text-gray-600">(-) {getCategoryLabel('other')}</span>
                <span className="text-red-500">{formatCurrency(num(legacyOther.other))}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Net Income */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="text-lg font-bold text-gray-800">UTILIDAD NETA</span>
          <span className={`text-2xl font-bold ${num(data.net_income) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(num(data.net_income))}
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-1">Margen Neto: {num(data.net_margin_percent).toFixed(1)}%</p>
      </div>
    </div>
  );
};

export default SnapshotIncomeStatement;
