import { type ReactElement, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Code2,
  FolderPlus,
  Folder,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  Loader2,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useProjects, useCreateProject, useDeleteProject, useUpdateProject } from '@/hooks/useProjects';
import { useTempo } from '@/hooks/useTempo';
import { formatAddress, formatTimeAgo } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { TEMPLATES } from '@/lib/templates';
import { Skeleton } from '@/components/ui/skeleton';

export const Route = createFileRoute('/portal')({
  component: PortalPage,
});

function PortalPage(): ReactElement {
  useAuthGuard();
  const navigate = useNavigate();
  const { address, disconnect } = useTempo();
  const { data: projects, isLoading } = useProjects();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const updateProject = useUpdateProject();

  const [showCreate, setShowCreate] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('blank');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleCreate = async () => {
    if (!newProjectName.trim()) return;
    try {
      const project = await createProject.mutateAsync({
        name: newProjectName.trim(),
        templateId: selectedTemplate,
      });
      setShowCreate(false);
      setNewProjectName('');
      setSelectedTemplate('blank');
      navigate({ to: '/ide/$projectId', params: { projectId: project.id } });
    } catch {
      toast.error('Failed to create project');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProject.mutateAsync(id);
      toast.success('Project deleted');
    } catch {
      toast.error('Failed to delete project');
    }
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) return;
    try {
      await updateProject.mutateAsync({ id, name: editName.trim() });
      setEditingId(null);
      toast.success('Project renamed');
    } catch {
      toast.error('Failed to rename project');
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    navigate({ to: '/' });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <nav className="h-14 bg-white border-b border-[#EDE9E3] px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Code2 className="w-5 h-5 text-[#E07A5F]" />
          <span className="font-bold text-[#2D3436]">Temporium</span>
          <span className="text-[#6B6560] font-light">| Playground</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F5F2ED] text-sm">
            <div className="w-2 h-2 rounded-full bg-[#5B9A6F]" />
            <span className="text-[#6B6560] text-xs">Tempo Testnet</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F5F2ED] text-sm text-[#2D3436]">
            {address && formatAddress(address)}
          </div>
          <Button variant="ghost" size="icon" onClick={handleDisconnect} className="w-9 h-9">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-[#2D3436]">Your Projects</h1>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-36 rounded-2xl" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && (!projects || projects.length === 0) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-[#E07A5F]/10 flex items-center justify-center mb-4">
              <FolderPlus className="w-8 h-8 text-[#E07A5F]" />
            </div>
            <h2 className="text-xl font-semibold text-[#2D3436] mb-2">No projects yet</h2>
            <p className="text-[#6B6560] mb-6 max-w-sm">
              Create your first project from a template or start with a blank canvas.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setSelectedTemplate('simple-storage'); setShowCreate(true); }}>
                <Sparkles className="w-4 h-4" />
                Start from Template
              </Button>
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="w-4 h-4" />
                Create Blank Project
              </Button>
            </div>
          </motion.div>
        )}

        {/* Projects grid */}
        {!isLoading && projects && projects.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project, i) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -2 }}
                className="group relative rounded-2xl border border-[#EDE9E3] bg-white p-5 cursor-pointer transition-all hover:shadow-lg hover:shadow-black/5 hover:border-[#E07A5F]/20"
                onClick={() => navigate({ to: '/ide/$projectId', params: { projectId: project.id } })}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#E07A5F]/10 flex items-center justify-center shrink-0">
                    <Folder className="w-5 h-5 text-[#E07A5F]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {editingId === project.id ? (
                      <Input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRename(project.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        onBlur={() => handleRename(project.id)}
                        autoFocus
                        className="h-7 text-sm"
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <h3 className="font-semibold text-[#2D3436] truncate">{project.name}</h3>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-[#6B6560]">
                  <span>{project.fileCount || 0} files</span>
                  <span>&middot;</span>
                  <span>{formatTimeAgo(new Date(project.updatedAt))}</span>
                  {project.templateId && (
                    <Badge variant="secondary" className="ml-auto text-[10px] bg-[#9B72CF]/10 text-[#9B72CF] border-0">
                      {project.templateId}
                    </Badge>
                  )}
                </div>

                {/* Hover actions */}
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(project.id);
                      setEditName(project.name);
                    }}
                    className="w-7 h-7 rounded-lg bg-[#F5F2ED] flex items-center justify-center hover:bg-[#EDE9E3] transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5 text-[#6B6560]" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(project.id);
                    }}
                    className="w-7 h-7 rounded-lg bg-[#F5F2ED] flex items-center justify-center hover:bg-[#E5484D]/10 hover:text-[#E5484D] transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md p-6">
          <DialogTitle className="text-lg font-bold mb-1">New Project</DialogTitle>
          <DialogDescription className="text-sm text-[#6B6560] mb-4">
            Give your project a name and optionally select a template.
          </DialogDescription>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#2D3436] mb-1.5 block">Project Name</label>
              <Input
                placeholder="My Contract"
                value={newProjectName}
                onChange={e => setNewProjectName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
            </div>

            <div>
              <label className="text-sm font-medium text-[#2D3436] mb-2 block">Template</label>
              <div className="grid grid-cols-2 gap-2">
                {TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTemplate(t.id)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedTemplate === t.id
                        ? 'border-[#E07A5F] bg-[#E07A5F]/5'
                        : 'border-[#EDE9E3] hover:border-[#E07A5F]/30'
                    }`}
                  >
                    <div className="text-sm font-medium text-[#2D3436]">{t.name}</div>
                    <div className="text-xs text-[#6B6560] mt-0.5 line-clamp-1">{t.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleCreate}
                disabled={!newProjectName.trim() || createProject.isPending}
                isLoading={createProject.isPending}
              >
                Create Project
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
