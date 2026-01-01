/**
 * Project card for the projects list.
 */

import type React from 'react';
import { Link } from '@tanstack/react-router';
import { FileCode2, Clock, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Project } from '@/lib/projects-storage';

interface ProjectCardProps {
  project: Project;
  onDelete: (id: string) => void;
}

export function ProjectCard({ project, onDelete }: ProjectCardProps): React.ReactElement {
  const handleDelete = (e: React.MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(`Delete project "${project.name}"?`)) {
      onDelete(project.id);
    }
  };

  return (
    <Card className="group relative transition-colors hover:bg-accent/50">
      <Link to="/portal/$projectId/editor" params={{ projectId: project.id }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileCode2 className="h-4 w-4" />
            {project.name}
          </CardTitle>
          <CardDescription className="line-clamp-1">
            {project.files.length} file{project.files.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatRelativeTime(project.updatedAt)}
          </div>
        </CardContent>
      </Link>

      {/* Delete button - appears on hover */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={handleDelete}
      >
        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
      </Button>
    </Card>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}
