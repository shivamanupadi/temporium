import type React from 'react';
import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ProjectCard, ProjectEmptyState, CreateProjectModal } from '@/components/projects';
import { useProjects, useDeleteProject } from '@/hooks/useProjects';

export const Route = createFileRoute('/portal/')({
  component: PortalIndexPage,
});

function PortalIndexPage(): React.ReactElement {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { data: projects, isLoading } = useProjects();
  const deleteProject = useDeleteProject();

  const handleDelete = (id: string): void => {
    deleteProject.mutate(id);
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-sm text-muted-foreground">Your Solidity projects</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : !projects || projects.length === 0 ? (
        <ProjectEmptyState onCreateNew={() => setIsCreateOpen(true)} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map(project => (
            <ProjectCard key={project.id} project={project} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <CreateProjectModal open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </div>
  );
}

function LoadingSkeleton(): React.ReactElement {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="rounded-lg border p-4">
          <Skeleton className="mb-2 h-5 w-32" />
          <Skeleton className="mb-4 h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}
