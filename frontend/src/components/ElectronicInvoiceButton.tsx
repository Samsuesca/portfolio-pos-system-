/**
 * ElectronicInvoiceButton - Facturacion Electronica DIAN (Alegra)
 *
 * Reusable inline control for a single document (sale / order / alteration).
 * On mount it looks up the document's invoice and renders one of:
 *   - "Facturar Electrónicamente" button   (no invoice, or previous attempt failed)
 *   - emitted pill + PDF / XML / Anular     (status = emitted)
 *   - "Factura anulada" pill                (status = voided)
 *
 * Emission is gated by `invoicing.emit`, annulment by `invoicing.void`, and the
 * whole control is hidden from users without `invoicing.view`.
 */
import { useEffect, useState } from 'react';
import {
  FileText, FileCheck, Ban, Download, RefreshCw, Loader2, AlertCircle, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { open as tauriOpen } from '@tauri-apps/plugin-shell';
import { RequirePermission } from './RequirePermission';
import { usePermissions } from '../hooks/usePermissions';
import { electronicInvoiceService } from '../services/electronicInvoiceService';
import type { ElectronicInvoice, InvoiceDocumentType } from '../types/api';

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

async function openExternal(url: string): Promise<void> {
  if (isTauri()) {
    try {
      await tauriOpen(url);
      return;
    } catch {
      // fall through to web behaviour
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

interface ElectronicInvoiceButtonProps {
  documentType: InvoiceDocumentType;
  documentId: string;
  /** Disable emission (e.g. cancelled document). */
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
}

export function ElectronicInvoiceButton({
  documentType,
  documentId,
  disabled = false,
  disabledReason,
  className,
}: ElectronicInvoiceButtonProps) {
  const { hasPermission } = usePermissions();
  const canView = hasPermission('invoicing.view');

  const [invoice, setInvoice] = useState<ElectronicInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [emitting, setEmitting] = useState(false);
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    electronicInvoiceService
      .getByDocument(documentType, documentId)
      .then((inv) => {
        if (active) setInvoice(inv);
      })
      .catch(() => {
        // Treat lookup failure as "no invoice yet" — the emit button still works.
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [documentType, documentId, canView]);

  if (!canView) return null;

  const handleEmit = async () => {
    setEmitting(true);
    try {
      const inv = await electronicInvoiceService.emit(documentType, documentId);
      setInvoice(inv);
      toast.success(`Factura electrónica emitida${inv.full_number ? `: ${inv.full_number}` : ''}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo emitir la factura');
    } finally {
      setEmitting(false);
    }
  };

  const handleVoid = async () => {
    if (!invoice) return;
    if (voidReason.trim().length < 3) {
      toast.error('Indica el motivo de la anulación');
      return;
    }
    setVoiding(true);
    try {
      const inv = await electronicInvoiceService.void(invoice.id, voidReason.trim());
      setInvoice(inv);
      setVoidModalOpen(false);
      setVoidReason('');
      toast.success('Factura anulada con nota crédito');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo anular la factura');
    } finally {
      setVoiding(false);
    }
  };

  if (loading) {
    return (
      <span className="inline-flex items-center text-sm text-gray-400">
        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
        FE…
      </span>
    );
  }

  // ── Emitted: pill + actions ──────────────────────────────────────
  if (invoice && invoice.status === 'emitted') {
    return (
      <div className={`inline-flex flex-wrap items-center gap-2 ${className ?? ''}`}>
        <span className="inline-flex items-center px-3 py-2 rounded-lg bg-green-50 text-green-700 text-sm font-medium border border-green-200">
          <FileCheck className="w-4 h-4 mr-1.5" />
          FE {invoice.full_number ?? 'emitida'}
        </span>
        {invoice.pdf_url && (
          <button
            onClick={() => openExternal(invoice.pdf_url!)}
            className="inline-flex items-center px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm transition"
            title="Descargar PDF de la factura"
          >
            <Download className="w-4 h-4 mr-1" />
            PDF
          </button>
        )}
        {invoice.xml_url && (
          <button
            onClick={() => openExternal(invoice.xml_url!)}
            className="inline-flex items-center px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm transition"
            title="Descargar XML de la factura"
          >
            <FileText className="w-4 h-4 mr-1" />
            XML
          </button>
        )}
        <RequirePermission permission="invoicing.void">
          <button
            onClick={() => setVoidModalOpen(true)}
            className="inline-flex items-center px-3 py-2 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 text-sm transition"
            title="Anular factura (nota crédito)"
          >
            <Ban className="w-4 h-4 mr-1" />
            Anular
          </button>
        </RequirePermission>

        {voidModalOpen && (
          <VoidModal
            invoice={invoice}
            reason={voidReason}
            onReasonChange={setVoidReason}
            onConfirm={handleVoid}
            onClose={() => setVoidModalOpen(false)}
            loading={voiding}
          />
        )}
      </div>
    );
  }

  // ── Voided ───────────────────────────────────────────────────────
  if (invoice && invoice.status === 'voided') {
    return (
      <span
        className={`inline-flex items-center px-3 py-2 rounded-lg bg-gray-100 text-gray-600 text-sm border border-gray-200 ${className ?? ''}`}
        title={invoice.void_reason ?? undefined}
      >
        <Ban className="w-4 h-4 mr-1.5" />
        Factura anulada{invoice.credit_note_number ? ` (NC ${invoice.credit_note_number})` : ''}
      </span>
    );
  }

  // ── No invoice or failed attempt: emit / retry ───────────────────
  const failed = invoice?.status === 'failed';
  return (
    <RequirePermission permission="invoicing.emit">
      <div className={`inline-flex items-center gap-2 ${className ?? ''}`}>
        <button
          onClick={handleEmit}
          disabled={emitting || disabled}
          title={
            disabled
              ? disabledReason
              : failed
                ? `Reintentar — último error: ${invoice?.error_message ?? 'desconocido'}`
                : 'Emitir factura electrónica DIAN'
          }
          className="inline-flex items-center px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition"
        >
          {emitting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : failed ? (
            <RefreshCw className="w-4 h-4 mr-2" />
          ) : (
            <FileText className="w-4 h-4 mr-2" />
          )}
          {emitting ? 'Facturando…' : failed ? 'Reintentar factura' : 'Facturar Electrónicamente'}
        </button>
        {failed && (
          <span className="inline-flex items-center text-red-500" title={invoice?.error_message ?? ''}>
            <AlertCircle className="w-4 h-4" />
          </span>
        )}
      </div>
    </RequirePermission>
  );
}

interface VoidModalProps {
  invoice: ElectronicInvoice;
  reason: string;
  onReasonChange: (v: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}

function VoidModal({ invoice, reason, onReasonChange, onConfirm, onClose, loading }: VoidModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={loading ? undefined : onClose} />
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Anular factura electrónica</h2>
          <button onClick={onClose} disabled={loading} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Se emitirá una <strong>nota crédito DIAN</strong> que anula la factura{' '}
            <strong>{invoice.full_number ?? ''}</strong>. Esta acción no se puede deshacer.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo de la anulación
            </label>
            <textarea
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Ej: Devolución total, error en los datos del cliente…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Ban className="w-4 h-4 mr-2" />}
            Anular factura
          </button>
        </div>
      </div>
    </div>
  );
}

export default ElectronicInvoiceButton;
