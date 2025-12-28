/**
 * Empty state for when no projects exist.
 */

import type React from 'react';
import { FileCode2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProjectEmptyStateProps {
  onCreateNew: () => void;
}

export function ProjectEmptyState({ onCreateNew }: ProjectEmptyStateProps): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
      <FileCode2 className="mb-4 h-12 w-12 text-muted-foreground" />
      <h3 className="mb-2 text-lg font-medium">No projects yet</h3>
      <p className="mb-4 text-center text-sm text-muted-foreground">
        Create a new project to start writing Solidity contracts
      </p>
      <Button onClick={onCreateNew}>
        <Plus className="mr-2 h-4 w-4" />
        New Project
      </Button>
    </div>
  );
}
