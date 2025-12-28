/**
 * Dynamic form for constructor arguments.
 */

import type React from 'react';
import { useState, useEffect, useMemo } from 'react';
import type { AbiParameter, Abi } from 'viem';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ConstructorArgsFormProps {
  abi: Abi;
  onChange: (args: unknown[]) => void;
}

export function ConstructorArgsForm({
  abi,
  onChange,
}: ConstructorArgsFormProps): React.ReactElement | null {
  const constructor = abi.find(item => item.type === 'constructor');
  const inputs = useMemo(
    () => (constructor && 'inputs' in constructor ? constructor.inputs : []),
    [constructor]
  );

  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    // Initialize empty values for each input
    const initial: Record<string, string> = {};
    inputs?.forEach((input, index) => {
      const key = input.name || `arg${index}`;
      initial[key] = values[key] ?? '';
    });
    if (Object.keys(initial).length !== Object.keys(values).length) {
      setValues(initial);
    }
  }, [inputs, values]);

  useEffect(() => {
    // Convert string values to appropriate types
    const args =
      inputs?.map((input, index) => {
        const key = input.name || `arg${index}`;
        const value = values[key] || '';
        return parseValue(value, input.type);
      }) ?? [];
    onChange(args);
  }, [values, inputs, onChange]);

  if (!inputs || inputs.length === 0) {
    return <div className="text-sm text-muted-foreground">No constructor arguments required</div>;
  }

  const handleChange = (key: string, value: string): void => {
    setValues(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-4">
      <label className="text-sm font-medium">Constructor Arguments</label>
      {inputs.map((input, index) => (
        <InputField
          key={input.name || index}
          input={input}
          index={index}
          value={values[input.name || `arg${index}`] || ''}
          onChange={value => handleChange(input.name || `arg${index}`, value)}
        />
      ))}
    </div>
  );
}

interface InputFieldProps {
  input: AbiParameter;
  index: number;
  value: string;
  onChange: (value: string) => void;
}

function InputField({ input, index, value, onChange }: InputFieldProps): React.ReactElement {
  const name = input.name || `arg${index}`;
  const type = input.type;

  return (
    <div className="space-y-2">
      <Label htmlFor={name} className="flex items-center gap-2">
        <span>{name}</span>
        <span className="font-mono text-xs text-muted-foreground">({type})</span>
      </Label>
      <Input
        id={name}
        placeholder={getPlaceholder(type)}
        value={value}
        onChange={e => onChange(e.target.value)}
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

function parseValue(value: string, type: string): unknown {
  if (!value) {
    if (type.startsWith('uint') || type.startsWith('int')) return 0n;
    if (type === 'bool') return false;
    if (type === 'address') return '0x0000000000000000000000000000000000000000';
    if (type === 'string') return '';
    if (type.startsWith('bytes')) return '0x';
    if (type.endsWith('[]')) return [];
    return value;
  }

  // Parse based on type
  if (type.startsWith('uint') || type.startsWith('int')) {
    return BigInt(value);
  }

  if (type === 'bool') {
    return value.toLowerCase() === 'true';
  }

  if (type.endsWith('[]')) {
    const baseType = type.slice(0, -2);
    return value.split(',').map(v => parseValue(v.trim(), baseType));
  }

  return value;
}
