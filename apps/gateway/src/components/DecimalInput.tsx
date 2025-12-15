import { useState, useEffect, useRef, type ReactElement } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface DecimalInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DecimalInput({
  value,
  onChange,
  placeholder = '0',
  className,
  disabled,
}: DecimalInputProps): ReactElement {
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync from parent when value changes externally (e.g., form reset)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const val = e.target.value.replace(/[^0-9.]/g, '');
    if (val.split('.').length <= 2) {
      setLocalValue(val);
      // Immediately sync to parent
      onChange(val);
    }
  };

  return (
    <Input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      value={localValue}
      onChange={handleChange}
      className={cn('h-10', className)}
      disabled={disabled}
    />
  );
}
