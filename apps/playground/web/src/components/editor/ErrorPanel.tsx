/**
 * Panel to display compilation errors and warnings - Clean, compact design.
 */

import type React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, FileCode } from 'lucide-react';
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
    <div className={cn('space-y-4', className)}>
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-lg',
            hasErrors ? 'bg-red-100' : hasWarnings ? 'bg-amber-100' : 'bg-green-100'
          )}
        >
          {hasErrors ? (
            <AlertCircle className="h-4 w-4 text-red-600" />
          ) : hasWarnings ? (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            {hasErrors ? 'Errors' : hasWarnings ? 'Warnings' : 'Success'}
          </h3>
          <p className="text-[11px] text-slate-500">
            {hasErrors
              ? `${errors.length} error${errors.length > 1 ? 's' : ''} found`
              : hasWarnings
                ? `${warnings.length} warning${warnings.length > 1 ? 's' : ''}`
                : 'Compiled successfully'}
          </p>
        </div>
      </div>

      {/* Content */}
      {isClean ? (
        <div className="rounded-xl border border-green-200 bg-green-50/50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100">
              <FileCode className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-[13px] font-medium text-green-700">Ready to deploy</p>
              <p className="text-[11px] text-green-600">No issues detected</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {errors.map((error, index) => (
            <ErrorItem key={`error-${index}`} error={error} type="error" />
          ))}
          {warnings.map((warning, index) => (
            <ErrorItem key={`warning-${index}`} error={warning} type="warning" />
          ))}
        </div>
      )}
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
    <div className={cn('rounded-lg p-3 text-[12px]', isError ? 'bg-red-50' : 'bg-amber-50')}>
      <div className="flex items-start gap-2">
        {isError ? (
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
        ) : (
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
        )}
        <div className="min-w-0 flex-1">
          <p className={cn('leading-relaxed', isError ? 'text-red-700' : 'text-amber-700')}>
            {error.message}
          </p>
          {error.sourceLocation && (
            <p className="mt-1.5 text-[10px] text-slate-500">
              {error.sourceLocation.file}:{error.sourceLocation.start}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
