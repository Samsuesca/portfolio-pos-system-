/**
 * Historical Sale Section
 * Toggle and date inputs for historical/migration sales
 */
import { History, Calendar } from 'lucide-react';
import type { SaleFormData } from './types';

interface HistoricalSaleSectionProps {
  formData: SaleFormData;
  onFormDataChange: (data: Partial<SaleFormData>) => void;
}

export default function HistoricalSaleSection({
  formData,
  onFormDataChange,
}: HistoricalSaleSectionProps) {
  const handleHistoricalToggle = (checked: boolean) => {
    onFormDataChange({
      is_historical: checked,
      sale_date: checked ? formData.sale_date : '',
      sale_day: checked ? formData.sale_day : '',
      sale_month: checked ? formData.sale_month : '',
      sale_year: checked ? formData.sale_year : '',
    });
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <div className="flex items-center h-5 mt-0.5">
          <input
            id="is_historical"
            type="checkbox"
            checked={formData.is_historical}
            onChange={(e) => handleHistoricalToggle(e.target.checked)}
            className="w-4 h-4 text-amber-600 border-amber-300 rounded focus:ring-amber-500"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="is_historical" className="text-sm font-semibold text-amber-800 flex items-center cursor-pointer">
            <History className="w-4 h-4 mr-2" />
            Venta Histórica (Migración de datos)
          </label>
          <p className="text-xs text-amber-700 mt-1">
            Las ventas históricas NO afectan el inventario actual y permiten establecer una fecha pasada.
            Útil para migrar registros de ventas anteriores.
          </p>
        </div>
      </div>

      {/* Date inputs for Historical Sales */}
      {formData.is_historical && (
        <div className="mt-4 pl-7">
          <label className="block text-sm font-medium text-amber-800 mb-2">
            <Calendar className="w-4 h-4 inline mr-1" />
            Fecha de la venta *
          </label>
          <div className="flex items-center gap-2">
            {/* Day */}
            <div>
              <input
                type="number"
                placeholder="Día"
                min="1"
                max="31"
                value={formData.sale_day}
                onChange={(e) => onFormDataChange({ sale_day: e.target.value })}
                className="w-20 px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none bg-white text-center"
              />
              <p className="text-xs text-amber-600 mt-1 text-center">Día</p>
            </div>
            <span className="text-amber-600 text-xl font-bold">/</span>
            {/* Month */}
            <div>
              <select
                value={formData.sale_month}
                onChange={(e) => onFormDataChange({ sale_month: e.target.value })}
                className="w-32 px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none bg-white"
              >
                <option value="">Mes</option>
                <option value="01">Enero</option>
                <option value="02">Febrero</option>
                <option value="03">Marzo</option>
                <option value="04">Abril</option>
                <option value="05">Mayo</option>
                <option value="06">Junio</option>
                <option value="07">Julio</option>
                <option value="08">Agosto</option>
                <option value="09">Septiembre</option>
                <option value="10">Octubre</option>
                <option value="11">Noviembre</option>
                <option value="12">Diciembre</option>
              </select>
              <p className="text-xs text-amber-600 mt-1 text-center">Mes</p>
            </div>
            <span className="text-amber-600 text-xl font-bold">/</span>
            {/* Year */}
            <div>
              <input
                type="number"
                placeholder="Año"
                min="2020"
                max={new Date().getFullYear()}
                value={formData.sale_year}
                onChange={(e) => onFormDataChange({ sale_year: e.target.value })}
                className="w-24 px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none bg-white text-center"
              />
              <p className="text-xs text-amber-600 mt-1 text-center">Año</p>
            </div>
          </div>
          <p className="text-xs text-amber-600 mt-2">
            Ingresa la fecha real en que se realizó esta venta
          </p>
        </div>
      )}
    </div>
  );
}
