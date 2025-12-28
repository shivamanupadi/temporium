/**
 * Panel to display compilation errors and warnings.
 */

import type React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CompileError } from '@/lib/compiler';

interface ErrorPanelProps {
  errors: CompileError[];
  warnings: CompileError[];
  className?: string;
}

export function ErrorPanel({ errors, warnings, className }: ErrorPanelProps): React.ReactElement {
  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0;
  const isClean = !hasErrors && !hasWarnings;

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-2">
        {hasErrors ? (
          <>
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="text-sm font-medium text-destructive">
              {errors.length} error{errors.length > 1 ? 's' : ''}
            </span>
          </>
        ) : hasWarnings ? (
          <>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-medium text-yellow-500">
              {warnings.length} warning{warnings.length > 1 ? 's' : ''}
            </span>
          </>
        ) : (
          <>
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium text-green-500">Compilation successful</span>
          </>
        )}
      </div>

      {/* Error/Warning list */}
      <div className="flex-1 overflow-auto bg-background p-2">
        {isClean ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No issues found
          </div>
        ) : (
          <div className="space-y-2">
            {errors.map((error, index) => (
              <ErrorItem key={`error-${index}`} error={error} type="error" />
            ))}
            {warnings.map((warning, index) => (
              <ErrorItem key={`warning-${index}`} error={warning} type="warning" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface ErrorItemProps {
  error: CompileError;
  type: 'error' | 'warning';
}

function ErrorItem({ error, type }: ErrorItemProps): React.ReactElement {
  const isError = type === 'error';

  return (
    <div
      className={cn(
        'rounded-md border p-3 text-sm',
        isError
          ? 'border-destructive/30 bg-destructive/10'
          : 'border-yellow-500/30 bg-yellow-500/10'
      )}
    >
      <div className="flex items-start gap-2">
        {isError ? (
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        ) : (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
        )}
        <div className="min-w-0 flex-1">
          <p className={cn('font-medium', isError ? 'text-destructive' : 'text-yellow-500')}>
            {error.message}
          </p>
          {error.sourceLocation && (
            <p className="mt-1 text-xs text-muted-foreground">
              {error.sourceLocation.file} (position {error.sourceLocation.start})
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
