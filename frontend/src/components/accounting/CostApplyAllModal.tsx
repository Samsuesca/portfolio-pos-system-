import React, { useState } from 'react';
import { X, Zap, Plus, Trash2 } from 'lucide-react';
import { formatCurrency } from '../../utils/formatting';

interface SizeDeltaEntry {
  sizes: string[];
  delta: number;
}

interface CostApplyAllModalProps {
  isOpen: boolean;
  onClose: () => void;
  componentName: string;
  availableSizes: string[];
  onApply: (amount: number, sizeDeltas: SizeDeltaEntry[]) => void;
}

const CostApplyAllModal: React.FC<CostApplyAllModalProps> = ({
  isOpen,
  onClose,
  componentName,
  availableSizes,
  onApply,
}) => {
  const [baseAmount, setBaseAmount] = useState<string>('');
  const [sizeDeltas, setSizeDeltas] = useState<SizeDeltaEntry[]>([]);

  const addDelta = () => {
    setSizeDeltas(prev => [...prev, { sizes: [], delta: 0 }]);
  };

  const removeDelta = (index: number) => {
    setSizeDeltas(prev => prev.filter((_, i) => i !== index));
  };

  const toggleSize = (deltaIndex: number, size: string) => {
    setSizeDeltas(prev => prev.map((d, i) => {
      if (i !== deltaIndex) return d;
      const sizes = d.sizes.includes(size)
        ? d.sizes.filter(s => s !== size)
        : [...d.sizes, size];
      return { ...d, sizes };
    }));
  };

  const updateDeltaAmount = (deltaIndex: number, value: string) => {
    setSizeDeltas(prev => prev.map((d, i) =>
      i === deltaIndex ? { ...d, delta: Number(value) || 0 } : d
    ));
  };

  const handleApply = () => {
    const amount = Number(baseAmount);
    if (amount <= 0) return;
    const validDeltas = sizeDeltas.filter(d => d.sizes.length > 0 && d.delta !== 0);
    onApply(amount, validDeltas);
    setBaseAmount('');
    setSizeDeltas([]);
    onClose();
  };

  const usedSizes = sizeDeltas.flatMap(d => d.sizes);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-stone-900">Aplicar a todos</h3>
            <p className="text-sm text-stone-500">{componentName}</p>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Valor base</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">$</span>
              <input
                type="number"
                value={baseAmount}
                onChange={(e) => setBaseAmount(e.target.value)}
                className="w-full pl-7 pr-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="0"
                autoFocus
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-stone-700">Ajuste por talla</label>
              <button
                onClick={addDelta}
                className="text-sm text-amber-600 hover:text-amber-700 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar ajuste
              </button>
            </div>

            {sizeDeltas.length === 0 && (
              <p className="text-xs text-stone-400 italic">
                Opcional. Usa ajustes para tallas que cuestan diferente (ej: tallas grandes usan mas tela).
              </p>
            )}

            {sizeDeltas.map((delta, idx) => (
              <div key={idx} className="mt-2 p-3 bg-stone-50 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-stone-500">Ajuste #{idx + 1}</span>
                  <button onClick={() => removeDelta(idx)} className="text-stone-400 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {availableSizes.map(size => {
                    const usedElsewhere = usedSizes.includes(size) && !delta.sizes.includes(size);
                    return (
                      <button
                        key={size}
                        onClick={() => !usedElsewhere && toggleSize(idx, size)}
                        disabled={usedElsewhere}
                        className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                          delta.sizes.includes(size)
                            ? 'bg-amber-100 border-amber-300 text-amber-800'
                            : usedElsewhere
                              ? 'bg-stone-100 border-stone-200 text-stone-300 cursor-not-allowed'
                              : 'border-stone-200 text-stone-600 hover:border-amber-300'
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-500">Delta:</span>
                  <div className="relative flex-1">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-stone-400 text-xs">+$</span>
                    <input
                      type="number"
                      value={delta.delta || ''}
                      onChange={(e) => updateDeltaAmount(idx, e.target.value)}
                      className="w-full pl-7 pr-2 py-1.5 text-sm border border-stone-200 rounded-md focus:ring-1 focus:ring-amber-500"
                      placeholder="0"
                    />
                  </div>
                </div>
                {baseAmount && delta.sizes.length > 0 && (
                  <p className="text-xs text-stone-500">
                    Tallas {delta.sizes.join(', ')}: {formatCurrency(Number(baseAmount) + delta.delta)}
                  </p>
                )}
              </div>
            ))}
          </div>

          {baseAmount && Number(baseAmount) > 0 && (
            <div className="p-3 bg-amber-50 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>Preview:</strong> Base {formatCurrency(Number(baseAmount))}
                {sizeDeltas.filter(d => d.sizes.length > 0).map((d, i) => (
                  <span key={i}> | Tallas {d.sizes.join(',')}: {formatCurrency(Number(baseAmount) + d.delta)}</span>
                ))}
              </p>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-stone-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg"
          >
            Cancelar
          </button>
          <button
            onClick={handleApply}
            disabled={!baseAmount || Number(baseAmount) <= 0}
            className="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <Zap className="w-4 h-4" /> Aplicar a todos
          </button>
        </div>
      </div>
    </div>
  );
};

export default CostApplyAllModal;
