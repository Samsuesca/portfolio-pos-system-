'use client';

/**
 * Upload Payment Proof Modal
 *
 * Modal for customers to upload payment proof (bank transfer receipt, etc.)
 * Supports .jpg, .png, .pdf files up to 5MB
 */

import { useState } from 'react';
import { X, Upload, FileText, Image as ImageIcon, AlertCircle, Check } from 'lucide-react';

interface UploadPaymentProofModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  onUploadSuccess: () => void;
}

export default function UploadPaymentProofModal({
  isOpen,
  onClose,
  orderId,
  onUploadSuccess
}: UploadPaymentProofModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!validTypes.includes(selectedFile.type)) {
      setError('Formato no válido. Solo se permiten archivos JPG, PNG o PDF.');
      return;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (selectedFile.size > maxSize) {
      setError('El archivo es muy grande. Tamaño máximo: 5MB');
      return;
    }

    setError(null);
    setFile(selectedFile);

    // Create preview for images
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      setPreview(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Por favor selecciona un archivo');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (notes.trim()) {
        formData.append('notes', notes.trim());
      }

      // Use Next.js API proxy to avoid CORS issues
      const response = await fetch(`/api/orders/${orderId}/upload-payment-proof`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Error al subir el comprobante');
      }

      console.log('[UploadModal] Upload successful, calling onUploadSuccess');
      setSuccess(true);
      setTimeout(() => {
        onUploadSuccess();
        console.log('[UploadModal] onUploadSuccess callback executed');
        handleClose();
      }, 2000);

    } catch (err: any) {
      console.error('Error uploading payment proof:', err);
      setError(err.message || 'Error al subir el comprobante. Por favor intenta de nuevo.');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreview(null);
    setNotes('');
    setError(null);
    setSuccess(false);
    onClose();
  };

  const getFileIcon = () => {
    if (!file) return <Upload className="w-12 h-12" />;
    if (file.type === 'application/pdf') return <FileText className="w-12 h-12" />;
    return <ImageIcon className="w-12 h-12" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">
            Subir Comprobante de Pago
          </h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
            disabled={uploading}
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Success Message */}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <Check className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-green-900">Comprobante subido exitosamente</p>
                <p className="text-sm text-green-700">Procesaremos tu pago pronto</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-900">Error</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* File Upload Area */}
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700 mb-2 block">
                Selecciona tu comprobante de pago
              </span>
              <div className={`
                border-2 border-dashed rounded-lg p-8
                ${file ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-gray-50'}
                hover:border-green-500 hover:bg-green-50
                transition cursor-pointer
              `}>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={uploading}
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className={file ? 'text-green-600' : 'text-gray-400'}>
                      {getFileIcon()}
                    </div>
                    {file ? (
                      <div>
                        <p className="font-semibold text-green-900">{file.name}</p>
                        <p className="text-sm text-green-700">
                          {(file.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-semibold text-gray-700">
                          Haz clic para seleccionar un archivo
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          JPG, PNG o PDF (máx. 5MB)
                        </p>
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </label>

            {/* Image Preview */}
            {preview && (
              <div className="border rounded-lg p-4 bg-gray-50">
                <p className="text-sm font-medium text-gray-700 mb-3">Vista previa:</p>
                <img
                  src={preview}
                  alt="Preview"
                  className="max-w-full h-auto max-h-64 mx-auto rounded border"
                />
              </div>
            )}

            {/* PDF Notice */}
            {file && file.type === 'application/pdf' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800">
                  Archivo PDF seleccionado. No se puede mostrar vista previa.
                </p>
              </div>
            )}
          </div>

          {/* Notes Field */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
              Notas adicionales (opcional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Ej: Pago realizado desde Nequi el 15 de diciembre"
              disabled={uploading}
              maxLength={500}
            />
            <p className="text-xs text-gray-500 mt-1">
              {notes.length}/500 caracteres
            </p>
          </div>

          {/* Instructions */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-yellow-900 mb-2">
              📋 Instrucciones:
            </p>
            <ul className="text-sm text-yellow-800 space-y-1 ml-4">
              <li className="list-disc">Asegúrate de que el comprobante sea legible</li>
              <li className="list-disc">Debe mostrar claramente el monto y la fecha</li>
              <li className="list-disc">Verificaremos el pago en las próximas 24 horas</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={handleClose}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition font-medium"
            disabled={uploading}
          >
            Cancelar
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className={`
              px-6 py-2 rounded-lg font-medium transition flex items-center gap-2
              ${file && !uploading
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            {uploading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Subiendo...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Subir Comprobante
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
