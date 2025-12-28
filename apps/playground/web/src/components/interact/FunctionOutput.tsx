/**
 * Display component for function return values.
 */

import type React from 'react';
import { cn } from '@/lib/utils';

interface FunctionOutputProps {
  value: unknown;
  className?: string;
}

export function FunctionOutput({ value, className }: FunctionOutputProps): React.ReactElement {
  const formattedValue = formatValue(value);

  return (
    <div className={cn('rounded-md border bg-muted/50 p-3 font-mono text-sm', className)}>
      <pre className="overflow-x-auto whitespace-pre-wrap break-all">{formattedValue}</pre>
    </div>
  );
}

function formatValue(value: unknown, indent = 0): string {
  const spaces = '  '.repeat(indent);

  if (value === null || value === undefined) {
    return 'null';
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'string') {
    // Check if it's an address
    if (value.startsWith('0x') && value.length === 42) {
      return value;
    }
    // Check if it's a hex bytes value
    if (value.startsWith('0x')) {
      return value;
    }
    return `"${value}"`;
  }

  if (typeof value === 'number') {
    return value.toString();
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map(item => formatValue(item, indent + 1));
    return `[\n${items.map(i => `${spaces}  ${i}`).join(',\n')}\n${spaces}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) return '{}';
    const items = entries.map(([key, val]) => `${spaces}  ${key}: ${formatValue(val, indent + 1)}`);
    return `{\n${items.join(',\n')}\n${spaces}}`;
  }

  return String(value);
}
