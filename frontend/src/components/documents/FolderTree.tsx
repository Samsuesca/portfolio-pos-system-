/**
 * FolderTree Component - Displays hierarchical folder structure
 */
import { useState } from 'react';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { DocumentFolderTree } from '../../types/document';

interface FolderTreeProps {
  folders: DocumentFolderTree[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (parentId: string | null) => void;
  onEditFolder: (folder: DocumentFolderTree) => void;
  onDeleteFolder: (folder: DocumentFolderTree) => void;
}

interface FolderItemProps {
  folder: DocumentFolderTree;
  level: number;
  selectedFolderId: string | null;
  expandedFolders: Set<string>;
  onSelectFolder: (folderId: string | null) => void;
  onToggleExpand: (folderId: string) => void;
  onEditFolder: (folder: DocumentFolderTree) => void;
  onDeleteFolder: (folder: DocumentFolderTree) => void;
}

function FolderItem({
  folder,
  level,
  selectedFolderId,
  expandedFolders,
  onSelectFolder,
  onToggleExpand,
  onEditFolder,
  onDeleteFolder,
}: FolderItemProps) {
  const isSelected = selectedFolderId === folder.id;
  const isExpanded = expandedFolders.has(folder.id);
  const hasChildren = folder.children.length > 0;

  return (
    <div>
      <div
        className={`
          group flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer transition-colors
          ${isSelected ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100'}
        `}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onSelectFolder(folder.id)}
      >
        {/* Expand/Collapse button */}
        <button
          className="p-0.5 hover:bg-gray-200 rounded"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggleExpand(folder.id);
          }}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )
          ) : (
            <span className="w-4 h-4" />
          )}
        </button>

        {/* Folder icon */}
        {isExpanded ? (
          <FolderOpen
            className="w-5 h-5 flex-shrink-0"
            style={{ color: folder.color || '#6B7280' }}
          />
        ) : (
          <Folder
            className="w-5 h-5 flex-shrink-0"
            style={{ color: folder.color || '#6B7280' }}
          />
        )}

        {/* Folder name */}
        <span className="flex-1 truncate text-sm font-medium">{folder.name}</span>

        {/* Document count badge */}
        {folder.documents_count > 0 && (
          <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
            {folder.documents_count}
          </span>
        )}

        {/* Action buttons (visible on hover) */}
        <div className="hidden group-hover:flex items-center gap-1">
          <button
            className="p-1 hover:bg-gray-200 rounded"
            onClick={(e) => {
              e.stopPropagation();
              onEditFolder(folder);
            }}
            title="Editar carpeta"
          >
            <Pencil className="w-3.5 h-3.5 text-gray-500" />
          </button>
          <button
            className="p-1 hover:bg-red-100 rounded"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteFolder(folder);
            }}
            title="Eliminar carpeta"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
          </button>
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {folder.children.map((child) => (
            <FolderItem
              key={child.id}
              folder={child}
              level={level + 1}
              selectedFolderId={selectedFolderId}
              expandedFolders={expandedFolders}
              onSelectFolder={onSelectFolder}
              onToggleExpand={onToggleExpand}
              onEditFolder={onEditFolder}
              onDeleteFolder={onDeleteFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FolderTree({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onEditFolder,
  onDeleteFolder,
}: FolderTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const handleToggleExpand = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <h3 className="font-semibold text-gray-700">Carpetas</h3>
        <button
          className="p-1 hover:bg-gray-100 rounded"
          onClick={() => onCreateFolder(null)}
          title="Nueva carpeta"
        >
          <Plus className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Folder list */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Root level (all documents) */}
        <div
          className={`
            flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors
            ${selectedFolderId === null ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100'}
          `}
          onClick={() => onSelectFolder(null)}
        >
          <Folder className="w-5 h-5 text-gray-500" />
          <span className="text-sm font-medium">Todos los documentos</span>
        </div>

        {/* Folders */}
        {folders.map((folder) => (
          <FolderItem
            key={folder.id}
            folder={folder}
            level={0}
            selectedFolderId={selectedFolderId}
            expandedFolders={expandedFolders}
            onSelectFolder={onSelectFolder}
            onToggleExpand={handleToggleExpand}
            onEditFolder={onEditFolder}
            onDeleteFolder={onDeleteFolder}
          />
        ))}

        {folders.length === 0 && (
          <div className="px-3 py-4 text-center text-gray-500 text-sm">
            No hay carpetas creadas
          </div>
        )}
      </div>
    </div>
  );
}
