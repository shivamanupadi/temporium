/**
 * Project switcher dropdown for the header.
 * Allows creating, editing, deleting, and switching between projects.
 */

import type React from 'react';
import { useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ChevronDown, Plus, Pencil, Trash2, FolderOpen, Check, X, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProjects, useProject, useRenameProject, useDeleteProject } from '@/hooks/useProjects';

interface ProjectSwitcherProps {
  onNewProject?: () => void;
}

export function ProjectSwitcher({ onNewProject }: ProjectSwitcherProps): React.ReactElement {
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const projectId = (params as { projectId?: string }).projectId;

  const { data: projects, isLoading } = useProjects();
  const { data: currentProject } = useProject(projectId);
  const renameProject = useRenameProject();
  const deleteProject = useDeleteProject();

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleRename = async (id: string): Promise<void> => {
    if (!editName.trim()) return;
    await renameProject.mutateAsync({ id, name: editName.trim() });
    setEditingId(null);
    setEditName('');
  };

  const handleDelete = async (id: string, name: string): Promise<void> => {
    if (!confirm(`Delete project "${name}"?`)) return;
    await deleteProject.mutateAsync(id);
    if (projectId === id) {
      navigate({ to: '/portal' });
    }
  };

  const handleSelect = (id: string): void => {
    setIsOpen(false);
    navigate({ to: '/portal/$projectId/editor', params: { projectId: id } });
  };

  const startEditing = (id: string, name: string, e: React.MouseEvent): void => {
    e.stopPropagation();
    setEditingId(id);
    setEditName(name);
  };

  const cancelEditing = (): void => {
    setEditingId(null);
    setEditName('');
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2 px-3 py-1.5 h-auto font-normal text-muted-foreground hover:text-foreground bg-gray-100 hover:bg-gray-200"
        >
          <FolderOpen className="h-4 w-4" />
          <span className="max-w-[150px] truncate">{currentProject?.name || 'Select Project'}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Projects
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Project List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : !projects || projects.length === 0 ? (
          <div className="px-2 py-3 text-center text-sm text-muted-foreground">No projects yet</div>
        ) : (
          <div className="max-h-[300px] overflow-y-auto">
            {projects.map(project => (
              <div key={project.id}>
                {editingId === project.id ? (
                  <div className="flex items-center gap-1 px-2 py-1.5">
                    <Input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="h-7 text-sm"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRename(project.id);
                        if (e.key === 'Escape') cancelEditing();
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => handleRename(project.id)}
                      disabled={renameProject.isPending}
                    >
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={cancelEditing}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <DropdownMenuItem
                    className={`flex items-center justify-between cursor-pointer group ${projectId === project.id ? 'bg-primary/10' : ''}`}
                    onSelect={() => handleSelect(project.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Check
                        className={`h-3.5 w-3.5 shrink-0 ${projectId === project.id ? 'text-primary' : 'invisible'}`}
                      />
                      <span className="truncate">{project.name}</span>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={e => startEditing(project.id, project.name, e)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={e => {
                          e.stopPropagation();
                          handleDelete(project.id, project.name);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </DropdownMenuItem>
                )}
              </div>
            ))}
          </div>
        )}

        <DropdownMenuSeparator />

        {/* Create New Project */}
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={() => {
            setIsOpen(false);
            onNewProject?.();
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
