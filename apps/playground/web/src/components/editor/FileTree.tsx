/**
 * File tree component for the IDE sidebar.
 * Displays files and folders with CRUD operations.
 */

import type React from 'react';
import { useState, useCallback } from 'react';
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  Pencil,
  Trash2,
  FilePlus,
  FolderPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  filesToTree,
  getFolderPaths,
  type ProjectFile,
  type TreeNode,
  type FolderNode,
} from '@/lib/projects-storage';

interface FileTreeProps {
  files: ProjectFile[];
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  onCreateFile: (path: string) => void;
  onCreateFolder: (path: string) => void;
  onRename: (oldPath: string, newPath: string) => void;
  onDelete: (path: string) => void;
  className?: string;
}

export function FileTree({
  files,
  selectedPath,
  onSelectFile,
  onCreateFile,
  onCreateFolder: _onCreateFolder,
  onRename,
  onDelete,
  className,
}: FileTreeProps): React.ReactElement {
  // Note: _onCreateFolder is available but folder creation is handled via internal creatingIn state
  void _onCreateFolder;
  // Get all folder paths (including from .gitkeep files)
  const allFolderPaths = getFolderPaths(files);

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(allFolderPaths));
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [creatingIn, setCreatingIn] = useState<{ folder: string; type: 'file' | 'folder' } | null>(
    null
  );
  const [newItemName, setNewItemName] = useState('');

  // Filter out .gitkeep placeholder files for display, but include empty folders
  const visibleFiles = files.filter(f => !f.path.endsWith('.gitkeep'));

  // Build tree from visible files, but also add empty folders from .gitkeep paths
  const gitkeepFolders = files
    .filter(f => f.path.endsWith('.gitkeep'))
    .map(f => f.path.replace('/.gitkeep', ''));

  const tree = filesToTree(visibleFiles, gitkeepFolders);

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const startRename = useCallback((path: string, name: string) => {
    setRenamingPath(path);
    setRenameValue(name);
  }, []);

  const handleRename = useCallback(() => {
    if (!renamingPath || !renameValue.trim()) {
      setRenamingPath(null);
      return;
    }

    const parts = renamingPath.split('/');
    parts[parts.length - 1] = renameValue.trim();
    const newPath = parts.join('/');

    if (newPath !== renamingPath) {
      onRename(renamingPath, newPath);
    }

    setRenamingPath(null);
    setRenameValue('');
  }, [renamingPath, renameValue, onRename]);

  const startCreating = useCallback((folderPath: string, type: 'file' | 'folder') => {
    setCreatingIn({ folder: folderPath, type });
    setNewItemName('');
    // Ensure the folder is expanded
    setExpandedFolders(prev => new Set([...prev, folderPath]));
  }, []);

  const handleCreate = useCallback(() => {
    if (!creatingIn || !newItemName.trim()) {
      setCreatingIn(null);
      return;
    }

    const path = creatingIn.folder
      ? `${creatingIn.folder}/${newItemName.trim()}`
      : newItemName.trim();

    if (creatingIn.type === 'file') {
      onCreateFile(path.endsWith('.sol') ? path : `${path}.sol`);
    } else {
      // For folders, we create a placeholder file
      onCreateFile(`${path}/.gitkeep`);
    }

    setCreatingIn(null);
    setNewItemName('');
  }, [creatingIn, newItemName, onCreateFile]);

  const handleDelete = useCallback(
    (path: string, name: string, isFolder: boolean) => {
      const msg = isFolder
        ? `Delete folder "${name}" and all its contents?`
        : `Delete file "${name}"?`;
      if (confirm(msg)) {
        onDelete(path);
      }
    },
    [onDelete]
  );

  const renderNode = (node: TreeNode, depth: number = 0): React.ReactElement => {
    const isFolder = node.type === 'folder';
    const isExpanded = isFolder && expandedFolders.has(node.path);
    const isSelected = node.path === selectedPath;
    const isRenaming = node.path === renamingPath;

    return (
      <div key={node.id}>
        <ContextMenu>
          <ContextMenuTrigger>
            <div
              className={cn(
                'group flex items-center gap-1 py-1 px-2 cursor-pointer text-sm',
                'hover:bg-accent/50 rounded-sm transition-colors',
                isSelected && 'bg-accent text-accent-foreground'
              )}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
              onClick={() => {
                if (isFolder) {
                  toggleFolder(node.path);
                } else {
                  onSelectFile(node.path);
                }
              }}
            >
              {/* Expand/collapse icon for folders */}
              {isFolder ? (
                <button
                  className="p-0.5 -ml-1"
                  onClick={e => {
                    e.stopPropagation();
                    toggleFolder(node.path);
                  }}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>
              ) : (
                <span className="w-4" />
              )}

              {/* Icon */}
              {isFolder ? (
                isExpanded ? (
                  <FolderOpen className="h-4 w-4 text-amber-500 shrink-0" />
                ) : (
                  <Folder className="h-4 w-4 text-amber-500 shrink-0" />
                )
              ) : (
                <File className="h-4 w-4 text-blue-400 shrink-0" />
              )}

              {/* Name or rename input */}
              {isRenaming ? (
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <Input
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    className="h-6 text-xs py-0 px-1"
                    autoFocus
                    onClick={e => e.stopPropagation()}
                    onKeyDown={e => {
                      e.stopPropagation();
                      if (e.key === 'Enter') handleRename();
                      if (e.key === 'Escape') setRenamingPath(null);
                    }}
                    onBlur={handleRename}
                  />
                </div>
              ) : (
                <span className="truncate">{node.name}</span>
              )}
            </div>
          </ContextMenuTrigger>

          <ContextMenuContent>
            {isFolder && (
              <>
                <ContextMenuItem onClick={() => startCreating(node.path, 'file')}>
                  <FilePlus className="mr-2 h-4 w-4" />
                  New File
                </ContextMenuItem>
                <ContextMenuItem onClick={() => startCreating(node.path, 'folder')}>
                  <FolderPlus className="mr-2 h-4 w-4" />
                  New Folder
                </ContextMenuItem>
                <ContextMenuSeparator />
              </>
            )}
            <ContextMenuItem onClick={() => startRename(node.path, node.name)}>
              <Pencil className="mr-2 h-4 w-4" />
              Rename
            </ContextMenuItem>
            <ContextMenuItem
              className="text-destructive"
              onClick={() => handleDelete(node.path, node.name, isFolder)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        {/* Folder children */}
        {isFolder && isExpanded && (
          <div>
            {/* Creating new item inside this folder */}
            {creatingIn?.folder === node.path && (
              <div
                className="flex items-center gap-1 py-1 px-2"
                style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
              >
                <span className="w-4" />
                {creatingIn.type === 'folder' ? (
                  <Folder className="h-4 w-4 text-amber-500 shrink-0" />
                ) : (
                  <File className="h-4 w-4 text-blue-400 shrink-0" />
                )}
                <Input
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                  placeholder={creatingIn.type === 'folder' ? 'folder name' : 'file.sol'}
                  className="h-6 text-xs py-0 px-1 flex-1"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreate();
                    if (e.key === 'Escape') setCreatingIn(null);
                  }}
                  onBlur={handleCreate}
                />
              </div>
            )}
            {(node as FolderNode).children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header with actions */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Files
        </span>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="New File"
            onClick={() => startCreating('', 'file')}
          >
            <FilePlus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="New Folder"
            onClick={() => startCreating('', 'folder')}
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {/* Creating at root level */}
        {creatingIn?.folder === '' && (
          <div className="flex items-center gap-1 py-1 px-2 pl-4">
            {creatingIn.type === 'folder' ? (
              <Folder className="h-4 w-4 text-amber-500 shrink-0" />
            ) : (
              <File className="h-4 w-4 text-blue-400 shrink-0" />
            )}
            <Input
              value={newItemName}
              onChange={e => setNewItemName(e.target.value)}
              placeholder={creatingIn.type === 'folder' ? 'folder name' : 'file.sol'}
              className="h-6 text-xs py-0 px-1 flex-1"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') setCreatingIn(null);
              }}
              onBlur={handleCreate}
            />
          </div>
        )}

        {tree.length === 0 && !creatingIn ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No files yet.
            <br />
            <button
              className="text-primary hover:underline mt-2"
              onClick={() => startCreating('', 'file')}
            >
              Create your first file
            </button>
          </div>
        ) : (
          tree.map(node => renderNode(node, 0))
        )}
      </div>
    </div>
  );
}
