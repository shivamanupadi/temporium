/**
 * Editor toolbar with compile and format buttons.
 */

import type React from 'react';
import { Play, Loader2, FileCode2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EditorToolbarProps {
  projectName: string;
  isCompiling: boolean;
  onCompile: () => void;
  onOpenTemplates: () => void;
}

export function EditorToolbar({
  projectName,
  isCompiling,
  onCompile,
  onOpenTemplates,
}: EditorToolbarProps): React.ReactElement {
  return (
    <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
      <div className="flex items-center gap-3">
        <FileCode2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{projectName}</span>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onOpenTemplates} disabled={isCompiling}>
          Templates
        </Button>

        <Button size="sm" onClick={onCompile} disabled={isCompiling} className="min-w-[100px]">
          {isCompiling ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Compiling
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Compile
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
