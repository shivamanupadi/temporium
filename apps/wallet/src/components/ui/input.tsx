import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md bg-white px-3 py-2 text-sm',
          'shadow-[0_0_0_1px_rgba(0,0,0,0.1)]',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          'placeholder:text-muted-foreground',
          'focus:outline-none focus:shadow-[0_0_0_1px_rgba(0,0,0,0.2)]',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
