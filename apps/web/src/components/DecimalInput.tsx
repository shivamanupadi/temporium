import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface DecimalInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function DecimalInput({
  value,
  onChange,
  placeholder = '0',
  className,
  disabled,
}: DecimalInputProps) {
  return (
    <Input
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      value={value}
      onChange={(e) => {
        const val = e.target.value.replace(/[^0-9.]/g, '')
        if (val.split('.').length <= 2) onChange(val)
      }}
      className={cn('h-10', className)}
      disabled={disabled}
    />
  )
}
