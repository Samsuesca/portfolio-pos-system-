/**
 * ReceiptPrintButton - Reusable button for printing receipts
 *
 * Opens the receipt in a new window and triggers the browser's print dialog.
 * Works with thermal printers (80mm) and regular printers.
 */
import { useState } from 'react';
import { Printer, Loader2 } from 'lucide-react';

interface ReceiptPrintButtonProps {
  /** Full URL to the receipt endpoint */
  receiptUrl: string;
  /** Button label */
  label?: string;
  /** Additional CSS classes */
  className?: string;
  /** Disable the button */
  disabled?: boolean;
  /** Icon size */
  iconSize?: number;
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'outline';
}

export default function ReceiptPrintButton({
  receiptUrl,
  label = 'Imprimir Recibo',
  className = '',
  disabled = false,
  iconSize = 5,
  variant = 'primary',
}: ReceiptPrintButtonProps) {
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = () => {
    if (disabled || isPrinting) return;

    setIsPrinting(true);

    // Open receipt in new window
    const printWindow = window.open(receiptUrl, '_blank', 'width=400,height=600');

    if (printWindow) {
      // Wait for content to load, then trigger print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          setIsPrinting(false);
        }, 500); // Small delay to ensure styles are applied
      };

      // Handle if window is closed before loading
      printWindow.onbeforeunload = () => {
        setIsPrinting(false);
      };

      // Fallback timeout in case onload doesn't fire
      setTimeout(() => {
        setIsPrinting(false);
      }, 5000);
    } else {
      // Popup blocked - try direct navigation
      window.location.href = receiptUrl;
      setIsPrinting(false);
    }
  };

  // Variant styles
  const variantStyles = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-600 hover:bg-gray-700 text-white',
    outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50',
  };

  return (
    <button
      onClick={handlePrint}
      disabled={disabled || isPrinting}
      className={`
        px-4 py-2 rounded-lg flex items-center transition
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {isPrinting ? (
        <Loader2 className={`w-${iconSize} h-${iconSize} mr-2 animate-spin`} />
      ) : (
        <Printer className={`w-${iconSize} h-${iconSize} mr-2`} />
      )}
      {isPrinting ? 'Imprimiendo...' : label}
    </button>
  );
}

/**
 * Smaller inline print button for use in tables or compact spaces
 */
export function ReceiptPrintIconButton({
  receiptUrl,
  disabled = false,
  title = 'Imprimir recibo',
}: {
  receiptUrl: string;
  disabled?: boolean;
  title?: string;
}) {
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = () => {
    if (disabled || isPrinting) return;

    setIsPrinting(true);
    const printWindow = window.open(receiptUrl, '_blank', 'width=400,height=600');

    if (printWindow) {
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          setIsPrinting(false);
        }, 500);
      };

      setTimeout(() => setIsPrinting(false), 5000);
    } else {
      window.location.href = receiptUrl;
      setIsPrinting(false);
    }
  };

  return (
    <button
      onClick={handlePrint}
      disabled={disabled || isPrinting}
      title={title}
      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition disabled:opacity-50"
    >
      {isPrinting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Printer className="w-4 h-4" />
      )}
    </button>
  );
}
