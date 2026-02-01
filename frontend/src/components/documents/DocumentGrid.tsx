/**
 * DocumentGrid Component - Displays documents in a grid layout
 */
import {
  FileText,
  Image,
  Table2,
  Download,
  Pencil,
  Trash2,
  Eye,
} from 'lucide-react';
import type { BusinessDocumentListItem } from '../../types/document';
import { formatFileSize, isImageMimeType, isPdfMimeType, getFileTypeName } from '../../types/document';

interface DocumentGridProps {
  documents: BusinessDocumentListItem[];
  onDownload: (document: BusinessDocumentListItem) => void;
  onPreview: (document: BusinessDocumentListItem) => void;
  onEdit: (document: BusinessDocumentListItem) => void;
  onDelete: (document: BusinessDocumentListItem) => void;
  isLoading?: boolean;
}

function getDocumentIcon(mimeType: string) {
  if (isPdfMimeType(mimeType)) {
    return <FileText className="w-12 h-12 text-red-500" />;
  }
  if (isImageMimeType(mimeType)) {
    return <Image className="w-12 h-12 text-blue-500" />;
  }
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
    return <Table2 className="w-12 h-12 text-green-500" />;
  }
  return <FileText className="w-12 h-12 text-gray-500" />;
}

function DocumentCard({
  document,
  onDownload,
  onPreview,
  onEdit,
  onDelete,
}: {
  document: BusinessDocumentListItem;
  onDownload: () => void;
  onPreview: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const canPreview = isImageMimeType(document.mime_type) || isPdfMimeType(document.mime_type);

  return (
    <div className="group relative bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
      {/* Document icon */}
      <div className="flex justify-center mb-3">
        {getDocumentIcon(document.mime_type)}
      </div>

      {/* Document info */}
      <div className="text-center">
        <h4 className="font-medium text-gray-900 truncate" title={document.name}>
          {document.name}
        </h4>
        <p className="text-xs text-gray-500 truncate" title={document.original_filename}>
          {document.original_filename}
        </p>
        <div className="flex items-center justify-center gap-2 mt-1">
          <span className="text-xs text-gray-400">{formatFileSize(document.file_size)}</span>
          <span className="text-xs text-gray-300">|</span>
          <span className="text-xs text-gray-400">{getFileTypeName(document.mime_type)}</span>
        </div>
      </div>

      {/* Action buttons (visible on hover) */}
      <div className="absolute top-2 right-2 hidden group-hover:flex items-center gap-1 bg-white/90 rounded p-1 shadow">
        {canPreview && (
          <button
            className="p-1.5 hover:bg-gray-100 rounded"
            onClick={onPreview}
            title="Vista previa"
          >
            <Eye className="w-4 h-4 text-gray-600" />
          </button>
        )}
        <button
          className="p-1.5 hover:bg-gray-100 rounded"
          onClick={onDownload}
          title="Descargar"
        >
          <Download className="w-4 h-4 text-blue-600" />
        </button>
        <button
          className="p-1.5 hover:bg-gray-100 rounded"
          onClick={onEdit}
          title="Editar"
        >
          <Pencil className="w-4 h-4 text-gray-600" />
        </button>
        <button
          className="p-1.5 hover:bg-red-50 rounded"
          onClick={onDelete}
          title="Eliminar"
        >
          <Trash2 className="w-4 h-4 text-red-500" />
        </button>
      </div>
    </div>
  );
}

export default function DocumentGrid({
  documents,
  onDownload,
  onPreview,
  onEdit,
  onDelete,
  isLoading = false,
}: DocumentGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-gray-100 rounded-lg h-40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <FileText className="w-16 h-16 mb-4 text-gray-300" />
        <p className="text-lg font-medium">No hay documentos</p>
        <p className="text-sm">Sube un archivo para comenzar</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {documents.map((doc) => (
        <DocumentCard
          key={doc.id}
          document={doc}
          onDownload={() => onDownload(doc)}
          onPreview={() => onPreview(doc)}
          onEdit={() => onEdit(doc)}
          onDelete={() => onDelete(doc)}
        />
      ))}
    </div>
  );
}
