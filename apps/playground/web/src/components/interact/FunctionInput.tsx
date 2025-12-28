/**
 * Input field generator for ABI function parameters.
 */

import type React from 'react';
import type { AbiParameter } from 'viem';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FunctionInputProps {
  input: AbiParameter;
  index: number;
  value: string;
  onChange: (value: string) => void;
}

export function FunctionInput({
  input,
  index,
  value,
  onChange,
}: FunctionInputProps): React.ReactElement {
  const name = input.name || `arg${index}`;
  const type = input.type;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={`input-${name}-${index}`} className="flex items-center gap-2 text-xs">
        <span className="font-medium">{name}</span>
        <span className="font-mono text-muted-foreground">({type})</span>
      </Label>
      <Input
        id={`input-${name}-${index}`}
        placeholder={getPlaceholder(type)}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-8 text-sm"
      />
    </div>
  );
}

function getPlaceholder(type: string): string {
  if (type === 'address') return '0x...';
  if (type.startsWith('uint') || type.startsWith('int')) return '0';
  if (type === 'bool') return 'true or false';
  if (type === 'string') return 'Enter text...';
  if (type.startsWith('bytes')) return '0x...';
  if (type.endsWith('[]')) return 'Comma-separated values';
  return 'Enter value...';
}

/**
 * Parse a string value to the appropriate type based on ABI type.
 */
export function parseInputValue(value: string, type: string): unknown {
  if (!value) {
    if (type.startsWith('uint') || type.startsWith('int')) return 0n;
    if (type === 'bool') return false;
    if (type === 'address') return '0x0000000000000000000000000000000000000000';
    if (type === 'string') return '';
    if (type.startsWith('bytes')) return '0x';
    if (type.endsWith('[]')) return [];
    return value;
  }

  if (type.startsWith('uint') || type.startsWith('int')) {
    return BigInt(value);
  }

  if (type === 'bool') {
    return value.toLowerCase() === 'true';
  }

  if (type.endsWith('[]')) {
    const baseType = type.slice(0, -2);
    return value.split(',').map(v => parseInputValue(v.trim(), baseType));
  }

  return value;
}
