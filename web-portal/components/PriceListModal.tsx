'use client';

import { useRef, useState } from 'react';
import { X, Printer, FileText, Download, Loader2 } from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import type { Product, School } from '@/lib/api';
import jsPDF from 'jspdf';

interface PriceListModalProps {
  isOpen: boolean;
  onClose: () => void;
  school: School;
  products: Product[];
  globalProducts: Product[];
}

interface PriceTableData {
  name: string;
  prices: { size: string; price: number }[];
}

interface ConsolidatedTableData {
  baseType: string;
  variants: { color: string; prices: { size: string; price: number }[] }[];
}

/**
 * Modal de Lista de Precios imprimible
 * Organiza los productos por tipo de prenda con sus tallas y precios
 */
export default function PriceListModal({
  isOpen,
  onClose,
  school,
  products,
  globalProducts
}: PriceListModalProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  // Función para ordenar tallas
  const sortSizes = (a: { size: string; price: number }, b: { size: string; price: number }) => {
    const numA = parseInt(a.size);
    const numB = parseInt(b.size);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL'];
    const idxA = sizeOrder.indexOf(a.size.toUpperCase());
    const idxB = sizeOrder.indexOf(b.size.toUpperCase());
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    return a.size.localeCompare(b.size);
  };

  // Detectar el tipo base de un producto (sin color)
  const getBaseType = (name: string): string => {
    const lower = name.toLowerCase();
    if (lower.includes('camiseta') || lower.includes('camisa')) return 'Camiseta';
    if (lower.includes('sudadera') || lower.includes('buzo')) return 'Sudadera';
    if (lower.includes('chompa')) return 'Chompa';
    if (lower.includes('yomber')) return 'Yomber';
    return name;
  };

  // Extraer color del nombre
  const getColor = (name: string): string => {
    const colorMatch = name.match(/\b(Azul|Gris|Amarillo|Morado|Fuxia|Rojo|Verde|Blanco|Negro)\b/i);
    return colorMatch ? colorMatch[1] : '';
  };

  // Agrupar productos por garment_type_id y extraer precios por talla
  const groupProducts = (prods: Product[]): PriceTableData[] => {
    const groups = new Map<string, { name: string; prices: Map<string, number> }>();

    prods.forEach(product => {
      const key = product.garment_type_id;
      const baseName = product.name
        .replace(/\s*-?\s*[Tt]alla\s*\d+\s*$/i, '')
        .replace(/\s*-?\s*T\d+(-T\d+)?\s*$/i, '')
        .replace(/\s+\d+\s*$/, '')
        .trim();

      if (!groups.has(key)) {
        groups.set(key, { name: baseName, prices: new Map() });
      }

      const group = groups.get(key)!;
      const size = product.size || 'Única';
      if (!group.prices.has(size) || group.prices.get(size)! > product.price) {
        group.prices.set(size, product.price);
      }
    });

    return Array.from(groups.values()).map(g => ({
      name: g.name,
      prices: Array.from(g.prices.entries())
        .map(([size, price]) => ({ size, price }))
        .sort(sortSizes)
    }));
  };

  // Agrupar productos consolidando colores del mismo tipo
  const groupProductsConsolidated = (prods: Product[]): ConsolidatedTableData[] => {
    const groups = new Map<string, Map<string, Map<string, number>>>();

    prods.forEach(product => {
      const baseName = product.name
        .replace(/\s*-?\s*[Tt]alla\s*\d+\s*$/i, '')
        .replace(/\s*-?\s*T\d+(-T\d+)?\s*$/i, '')
        .replace(/\s+\d+\s*$/, '')
        .trim();

      const baseType = getBaseType(baseName);
      const color = getColor(baseName) || 'default';
      const size = product.size || 'Única';

      if (!groups.has(baseType)) {
        groups.set(baseType, new Map());
      }
      const typeGroup = groups.get(baseType)!;

      if (!typeGroup.has(color)) {
        typeGroup.set(color, new Map());
      }
      const colorGroup = typeGroup.get(color)!;

      if (!colorGroup.has(size) || colorGroup.get(size)! > product.price) {
        colorGroup.set(size, product.price);
      }
    });

    const result: ConsolidatedTableData[] = [];
    groups.forEach((colorMap, baseType) => {
      const variants = Array.from(colorMap.entries()).map(([color, priceMap]) => ({
        color: color === 'default' ? '' : color,
        prices: Array.from(priceMap.entries())
          .map(([size, price]) => ({ size, price }))
          .sort(sortSizes)
      }));
      result.push({ baseType, variants });
    });

    return result;
  };

  // Separar productos del colegio y globales
  const schoolTables = groupProducts(products);
  const consolidatedTables = groupProductsConsolidated(products);
  const globalTables = groupProducts(globalProducts);

  // Determinar si usar tablas consolidadas (cuando hay múltiples colores del mismo tipo)
  const hasMultipleColors = consolidatedTables.some(t => t.variants.length > 1);

  // Categorizar las tablas del colegio
  const camisetas = schoolTables.filter(t =>
    t.name.toLowerCase().includes('camiseta') || t.name.toLowerCase().includes('camisa')
  );
  const sudaderas = schoolTables.filter(t =>
    t.name.toLowerCase().includes('sudadera') || t.name.toLowerCase().includes('buzo')
  );
  const chompas = schoolTables.filter(t =>
    t.name.toLowerCase().includes('chompa')
  );
  const yomber = schoolTables.filter(t =>
    t.name.toLowerCase().includes('yomber')
  );
  const otros = schoolTables.filter(t =>
    !t.name.toLowerCase().includes('camiseta') &&
    !t.name.toLowerCase().includes('camisa') &&
    !t.name.toLowerCase().includes('sudadera') &&
    !t.name.toLowerCase().includes('buzo') &&
    !t.name.toLowerCase().includes('chompa') &&
    !t.name.toLowerCase().includes('yomber')
  );

  // Tablas consolidadas por tipo
  const consolidatedCamisetas = consolidatedTables.filter(t =>
    t.baseType.toLowerCase().includes('camiseta') || t.baseType.toLowerCase().includes('camisa')
  );
  const consolidatedSudaderas = consolidatedTables.filter(t =>
    t.baseType.toLowerCase().includes('sudadera') || t.baseType.toLowerCase().includes('buzo')
  );
  const consolidatedChompas = consolidatedTables.filter(t =>
    t.baseType.toLowerCase().includes('chompa')
  );
  const consolidatedYomber = consolidatedTables.filter(t =>
    t.baseType.toLowerCase().includes('yomber')
  );
  const consolidatedOtros = consolidatedTables.filter(t =>
    !t.baseType.toLowerCase().includes('camiseta') &&
    !t.baseType.toLowerCase().includes('camisa') &&
    !t.baseType.toLowerCase().includes('sudadera') &&
    !t.baseType.toLowerCase().includes('buzo') &&
    !t.baseType.toLowerCase().includes('chompa') &&
    !t.baseType.toLowerCase().includes('yomber')
  );

  // Generar PDF directamente con jsPDF (sin html2canvas)
  const generatePDF = (): jsPDF => {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 15;
    let y = 20;

    // Header
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text('CONSUELO RIOS', pageWidth / 2, y, { align: 'center' });
    y += 7;

    pdf.setFontSize(12);
    pdf.text('Confección y Venta de Uniformes', pageWidth / 2, y, { align: 'center' });
    y += 6;

    pdf.setFontSize(14);
    pdf.text(`${new Date().getFullYear()}`, pageWidth / 2, y, { align: 'center' });
    y += 8;

    pdf.setFontSize(11);
    pdf.text(school.name.toUpperCase(), pageWidth / 2, y, { align: 'center' });
    y += 5;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text('TELÉFONO: 3001234567', pageWidth / 2, y, { align: 'center' });
    y += 3;

    // Línea separadora
    pdf.setLineWidth(0.5);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Función para dibujar una tabla
    const drawTable = (title: string, prices: { size: string; price: number }[], startX: number, startY: number, width: number): number => {
      const rowHeight = 5;
      const headerHeight = 6;
      let currentY = startY;

      // Título de la tabla
      pdf.setFillColor(240, 240, 240);
      pdf.rect(startX, currentY, width, headerHeight, 'F');
      pdf.setDrawColor(50, 50, 50);
      pdf.rect(startX, currentY, width, headerHeight, 'S');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.text(title.toUpperCase(), startX + width / 2, currentY + 4, { align: 'center' });
      currentY += headerHeight;

      // Header de columnas
      pdf.setFillColor(250, 250, 250);
      pdf.rect(startX, currentY, width, rowHeight, 'F');
      pdf.rect(startX, currentY, width, rowHeight, 'S');

      pdf.setFontSize(8);
      pdf.text('TALLA', startX + 3, currentY + 3.5);
      pdf.text('PRECIO', startX + width - 3, currentY + 3.5, { align: 'right' });
      currentY += rowHeight;

      // Filas de datos
      pdf.setFont('helvetica', 'normal');
      prices.forEach((item, idx) => {
        if (idx % 2 === 0) {
          pdf.setFillColor(255, 255, 255);
        } else {
          pdf.setFillColor(248, 248, 248);
        }
        pdf.rect(startX, currentY, width, rowHeight, 'F');
        pdf.rect(startX, currentY, width, rowHeight, 'S');

        pdf.text(item.size, startX + 3, currentY + 3.5);
        pdf.text(`$ ${formatNumber(item.price)}`, startX + width - 3, currentY + 3.5, { align: 'right' });
        currentY += rowHeight;
      });

      return currentY;
    };

    // Función para dibujar tabla consolidada (múltiples colores)
    const drawConsolidatedTable = (data: ConsolidatedTableData, startX: number, startY: number, width: number): number => {
      if (data.variants.length === 1 && !data.variants[0].color) {
        return drawTable(data.baseType, data.variants[0].prices, startX, startY, width);
      }

      const rowHeight = 5;
      const headerHeight = 6;
      let currentY = startY;

      const colors = data.variants.map(v => v.color).filter(c => c);
      const allSizes = new Set<string>();
      data.variants.forEach(v => v.prices.forEach(p => allSizes.add(p.size)));
      const sortedSizes = Array.from(allSizes).sort((a, b) => {
        const numA = parseInt(a);
        const numB = parseInt(b);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b);
      });

      // Título
      pdf.setFillColor(240, 240, 240);
      pdf.rect(startX, currentY, width, headerHeight, 'F');
      pdf.setDrawColor(50, 50, 50);
      pdf.rect(startX, currentY, width, headerHeight, 'S');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.text(data.baseType.toUpperCase(), startX + width / 2, currentY + 4, { align: 'center' });
      currentY += headerHeight;

      // Header con colores
      const colWidth = (width - 15) / colors.length;
      pdf.setFillColor(250, 250, 250);
      pdf.rect(startX, currentY, width, rowHeight, 'F');
      pdf.rect(startX, currentY, width, rowHeight, 'S');

      pdf.setFontSize(7);
      pdf.text('TALLA', startX + 3, currentY + 3.5);
      colors.forEach((color, idx) => {
        pdf.text(color.toUpperCase(), startX + 15 + (idx * colWidth) + colWidth / 2, currentY + 3.5, { align: 'center' });
      });
      currentY += rowHeight;

      // Crear mapa de precios
      const priceMap = new Map<string, Map<string, number>>();
      data.variants.forEach(v => {
        const colorPrices = new Map<string, number>();
        v.prices.forEach(p => colorPrices.set(p.size, p.price));
        priceMap.set(v.color, colorPrices);
      });

      // Filas
      pdf.setFont('helvetica', 'normal');
      sortedSizes.forEach((size, idx) => {
        if (idx % 2 === 0) {
          pdf.setFillColor(255, 255, 255);
        } else {
          pdf.setFillColor(248, 248, 248);
        }
        pdf.rect(startX, currentY, width, rowHeight, 'F');
        pdf.rect(startX, currentY, width, rowHeight, 'S');

        pdf.text(size, startX + 3, currentY + 3.5);
        colors.forEach((color, colIdx) => {
          const price = priceMap.get(color)?.get(size);
          const text = price ? `$${formatNumber(price)}` : '-';
          pdf.text(text, startX + 15 + (colIdx * colWidth) + colWidth / 2, currentY + 3.5, { align: 'center' });
        });
        currentY += rowHeight;
      });

      return currentY;
    };

    // Calcular disposición de tablas (3 columnas)
    const tableWidth = (pageWidth - margin * 2 - 10) / 3;
    let currentX = margin;
    let currentY = y;
    let maxY = y;
    let columnIndex = 0;

    // Obtener todas las tablas a dibujar
    const allTables: { type: 'simple' | 'consolidated'; data: PriceTableData | ConsolidatedTableData }[] = [];

    if (hasMultipleColors) {
      consolidatedCamisetas.forEach(t => allTables.push({ type: 'consolidated', data: t }));
      consolidatedSudaderas.forEach(t => allTables.push({ type: 'consolidated', data: t }));
      consolidatedChompas.forEach(t => allTables.push({ type: 'consolidated', data: t }));
      consolidatedYomber.forEach(t => allTables.push({ type: 'consolidated', data: t }));
      consolidatedOtros.forEach(t => allTables.push({ type: 'consolidated', data: t }));
    } else {
      camisetas.forEach(t => allTables.push({ type: 'simple', data: t }));
      sudaderas.forEach(t => allTables.push({ type: 'simple', data: t }));
      chompas.forEach(t => allTables.push({ type: 'simple', data: t }));
      yomber.forEach(t => allTables.push({ type: 'simple', data: t }));
      otros.forEach(t => allTables.push({ type: 'simple', data: t }));
    }

    // Dibujar tablas del colegio
    allTables.forEach((table) => {
      let tableEndY: number;

      if (table.type === 'consolidated') {
        tableEndY = drawConsolidatedTable(table.data as ConsolidatedTableData, currentX, currentY, tableWidth);
      } else {
        const simpleData = table.data as PriceTableData;
        tableEndY = drawTable(simpleData.name, simpleData.prices, currentX, currentY, tableWidth);
      }

      maxY = Math.max(maxY, tableEndY);
      columnIndex++;

      if (columnIndex >= 3) {
        columnIndex = 0;
        currentX = margin;
        currentY = maxY + 5;
        maxY = currentY;
      } else {
        currentX += tableWidth + 5;
      }
    });

    // Productos Globales
    if (globalTables.length > 0) {
      y = maxY + 10;

      // Verificar si necesitamos nueva página
      if (y > pdf.internal.pageSize.getHeight() - 50) {
        pdf.addPage();
        y = 20;
      }

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.text('PRODUCTOS ADICIONALES (Disponibles para todos los colegios)', pageWidth / 2, y, { align: 'center' });
      y += 6;

      const smallTableWidth = (pageWidth - margin * 2 - 15) / 4;
      currentX = margin;
      currentY = y;
      maxY = y;
      columnIndex = 0;

      globalTables.forEach((table) => {
        const tableEndY = drawTable(table.name, table.prices, currentX, currentY, smallTableWidth);
        maxY = Math.max(maxY, tableEndY);
        columnIndex++;

        if (columnIndex >= 4) {
          columnIndex = 0;
          currentX = margin;
          currentY = maxY + 3;
          maxY = currentY;
        } else {
          currentX += smallTableWidth + 5;
        }
      });
    }

    // Footer
    y = Math.max(maxY, y) + 10;
    if (y > pdf.internal.pageSize.getHeight() - 20) {
      y = pdf.internal.pageSize.getHeight() - 15;
    }

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(128, 128, 128);
    pdf.text('* Precios sujetos a cambios sin previo aviso', pageWidth / 2, y, { align: 'center' });
    y += 4;
    pdf.text('www.yourdomain.com', pageWidth / 2, y, { align: 'center' });

    return pdf;
  };

  const handleGeneratePDF = async () => {
    if (isGenerating) return;

    setIsGenerating(true);

    try {
      const pdf = generatePDF();

      // Generar nombre del archivo
      const schoolSlug = school.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const fileName = `lista-precios-${schoolSlug}-${new Date().getFullYear()}.pdf`;

      // Descargar el PDF
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error al generar el PDF. Por favor intenta de nuevo.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = async () => {
    if (isGenerating) return;

    setIsGenerating(true);

    try {
      const pdf = generatePDF();

      // Abrir en nueva ventana para imprimir
      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const printWindow = window.open(pdfUrl, '_blank');

      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    } catch (error) {
      console.error('Error generating PDF for print:', error);
      alert('Error al preparar la impresión. Por favor intenta de nuevo.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Componente de tabla de precios
  const PriceTable = ({ data, className = '' }: { data: PriceTableData; className?: string }) => (
    <div className={`border-2 border-gray-800 ${className}`}>
      <div className="bg-gray-100 border-b-2 border-gray-800 px-3 py-2">
        <h3 className="font-bold text-center text-sm uppercase tracking-wide">{data.name}</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-400">
            <th className="px-3 py-1 text-left font-semibold">TALLA</th>
            <th className="px-3 py-1 text-right font-semibold">PRECIO</th>
          </tr>
        </thead>
        <tbody>
          {data.prices.map((item, idx) => (
            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-3 py-1 border-t border-gray-200">{item.size}</td>
              <td className="px-3 py-1 border-t border-gray-200 text-right">
                $ {formatNumber(item.price)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Componente de tabla consolidada con múltiples colores
  const ConsolidatedTable = ({ data }: { data: ConsolidatedTableData }) => {
    // Si solo hay un color (o ninguno), mostrar tabla simple
    if (data.variants.length === 1 && !data.variants[0].color) {
      return (
        <PriceTable data={{ name: data.baseType, prices: data.variants[0].prices }} />
      );
    }

    // Obtener todas las tallas únicas ordenadas
    const allSizes = new Set<string>();
    data.variants.forEach(v => v.prices.forEach(p => allSizes.add(p.size)));
    const sortedSizes = Array.from(allSizes).sort((a, b) => {
      const numA = parseInt(a);
      const numB = parseInt(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });

    // Crear mapa de precios por color y talla
    const priceMap = new Map<string, Map<string, number>>();
    data.variants.forEach(v => {
      const colorPrices = new Map<string, number>();
      v.prices.forEach(p => colorPrices.set(p.size, p.price));
      priceMap.set(v.color, colorPrices);
    });

    const colors = data.variants.map(v => v.color).filter(c => c);

    return (
      <div className="border-2 border-gray-800">
        <div className="bg-gray-100 border-b-2 border-gray-800 px-3 py-2">
          <h3 className="font-bold text-center text-sm uppercase tracking-wide">{data.baseType}</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-400 bg-gray-50">
              <th className="px-2 py-1 text-left font-semibold text-xs">TALLA</th>
              {colors.map(color => (
                <th key={color} className="px-2 py-1 text-right font-semibold text-xs">{color.toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedSizes.map((size, idx) => (
              <tr key={size} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-2 py-1 border-t border-gray-200 font-medium">{size}</td>
                {colors.map(color => {
                  const price = priceMap.get(color)?.get(size);
                  return (
                    <td key={color} className="px-2 py-1 border-t border-gray-200 text-right">
                      {price ? `$${formatNumber(price)}` : '-'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Componente de tabla compacta para productos globales
  const CompactTable = ({ data }: { data: PriceTableData }) => (
    <div className="border-2 border-gray-800">
      <div className="bg-gray-100 border-b-2 border-gray-800 px-2 py-1">
        <h3 className="font-bold text-center text-xs uppercase">{data.name}</h3>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-400">
            <th className="px-2 py-1 text-left font-semibold">TALLA</th>
            <th className="px-2 py-1 text-right font-semibold">PRECIO</th>
          </tr>
        </thead>
        <tbody>
          {data.prices.map((item, idx) => (
            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-2 py-0.5 border-t border-gray-200">{item.size}</td>
              <td className="px-2 py-0.5 border-t border-gray-200 text-right">
                $ {formatNumber(item.price)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/60 z-50 print:hidden"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-4 md:inset-8 lg:inset-12 bg-white rounded-xl z-50 flex flex-col overflow-hidden print:fixed print:inset-0 print:rounded-none">
        {/* Header - No se imprime */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-amber-600 to-amber-700 print:hidden">
          <div className="flex items-center gap-3 text-white">
            <FileText className="w-6 h-6" />
            <div>
              <h2 className="text-xl font-bold">Lista de Precios</h2>
              <p className="text-sm text-amber-100">{school.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleGeneratePDF}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2 bg-white text-amber-700 rounded-lg font-medium hover:bg-amber-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Download className="w-5 h-5" />
              )}
              {isGenerating ? 'Generando...' : 'Descargar PDF'}
            </button>
            <button
              onClick={handlePrint}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg font-medium hover:bg-amber-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Printer className="w-5 h-5" />
              Imprimir
            </button>
            <button
              onClick={onClose}
              className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content - Área imprimible */}
        <div
          ref={printRef}
          className="flex-1 overflow-auto p-6 print:p-0 print:overflow-visible"
        >
          {/* Contenido imprimible */}
          <div className="max-w-4xl mx-auto print:max-w-none print:mx-0">
            {/* Encabezado de la lista */}
            <div className="text-center mb-6 pb-4 border-b-4 border-double border-gray-800 print:mb-4 print:pb-2">
              <h1 className="text-2xl font-black uppercase tracking-wide print:text-xl">
                CONSUELO RIOS
              </h1>
              <p className="text-lg font-semibold uppercase print:text-base">
                Confección y Venta de Uniformes
              </p>
              <p className="text-xl font-bold mt-1 print:text-lg">{new Date().getFullYear()}</p>
              <p className="text-lg font-semibold uppercase mt-2 print:text-base print:mt-1">
                {school.name}
              </p>
              <p className="text-base mt-1 print:text-sm">
                TELÉFONO: 3001234567
              </p>
            </div>

            {/* Productos del Colegio */}
            {hasMultipleColors ? (
              /* Vista consolidada para colegios con múltiples colores (ej: CONFAMA) */
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 print:grid-cols-3 print:gap-2 print:mb-4">
                {consolidatedCamisetas.map((table, idx) => (
                  <ConsolidatedTable key={`cam-${idx}`} data={table} />
                ))}
                {consolidatedSudaderas.map((table, idx) => (
                  <ConsolidatedTable key={`sud-${idx}`} data={table} />
                ))}
                {consolidatedChompas.map((table, idx) => (
                  <ConsolidatedTable key={`cho-${idx}`} data={table} />
                ))}
                {consolidatedYomber.map((table, idx) => (
                  <ConsolidatedTable key={`yom-${idx}`} data={table} />
                ))}
                {consolidatedOtros.map((table, idx) => (
                  <ConsolidatedTable key={`otr-${idx}`} data={table} />
                ))}
              </div>
            ) : (
              /* Vista normal para colegios sin múltiples colores */
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 print:grid-cols-3 print:gap-2 print:mb-4">
                  {/* Camisetas */}
                  {camisetas.length > 0 && camisetas.map((table, idx) => (
                    <PriceTable key={`cam-${idx}`} data={table} />
                  ))}

                  {/* Sudaderas */}
                  {sudaderas.length > 0 && sudaderas.map((table, idx) => (
                    <PriceTable key={`sud-${idx}`} data={table} />
                  ))}

                  {/* Chompas */}
                  {chompas.length > 0 && chompas.map((table, idx) => (
                    <PriceTable key={`cho-${idx}`} data={table} />
                  ))}
                </div>

                {/* Yomber y Otros productos del colegio */}
                {(yomber.length > 0 || otros.length > 0) && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 print:grid-cols-3 print:gap-2 print:mb-4">
                    {yomber.map((table, idx) => (
                      <PriceTable key={`yom-${idx}`} data={table} />
                    ))}
                    {otros.map((table, idx) => (
                      <PriceTable key={`otr-${idx}`} data={table} />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Productos Globales */}
            {globalTables.length > 0 && (
              <>
                <div className="border-t-2 border-gray-300 pt-4 mt-4 print:pt-2 print:mt-2">
                  <h2 className="text-center font-bold text-sm uppercase mb-3 text-gray-600 print:text-xs print:mb-2">
                    Productos Adicionales (Disponibles para todos los colegios)
                  </h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print:grid-cols-4 print:gap-2">
                  {globalTables.map((table, idx) => (
                    <CompactTable key={`glob-${idx}`} data={table} />
                  ))}
                </div>
              </>
            )}

            {/* Footer */}
            <div className="mt-6 pt-4 border-t-2 border-gray-300 text-center text-xs text-gray-500 print:mt-4 print:pt-2">
              <p>* Precios sujetos a cambios sin previo aviso</p>
              <p className="mt-1">www.yourdomain.com</p>
            </div>
          </div>
        </div>

        {/* Footer con tips - No se imprime */}
        <div className="px-6 py-3 border-t bg-blue-50 print:hidden">
          <div className="flex items-center gap-3 text-blue-700">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-lg">💡</span>
            </div>
            <p className="text-sm">
              <strong>Tip:</strong> Puedes agregar productos a tu carrito desde el catálogo y ver el total de tu cotización antes de hacer el pedido.
            </p>
          </div>
        </div>
      </div>

    </>
  );
}
