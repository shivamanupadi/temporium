import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-[0_1px_2px_0_rgba(0,0,0,0.05),0_0_0_1px_rgba(99,91,255,1)] hover:bg-primary-hover hover:shadow-[0_3px_8px_0_rgba(99,91,255,0.25),0_0_0_1px_rgba(99,91,255,1)]',
        destructive:
          'bg-destructive text-white shadow-[0_1px_2px_0_rgba(0,0,0,0.05),0_0_0_1px_rgba(223,27,65,1)] hover:bg-destructive/90 hover:shadow-[0_3px_8px_0_rgba(223,27,65,0.25),0_0_0_1px_rgba(223,27,65,1)]',
        outline:
          'border border-border/50 bg-white text-foreground shadow-[0_1px_2px_0_rgba(0,0,0,0.04)] hover:bg-muted hover:border-border hover:shadow-[0_3px_8px_0_rgba(0,0,0,0.06)]',
        secondary: 'bg-muted text-foreground hover:bg-muted/80',
        ghost: 'hover:bg-muted hover:text-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3 text-xs',
        lg: 'h-11 rounded-lg px-6',
        xl: 'h-12 rounded-xl px-8 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, isLoading, children, disabled, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
          {children}
        </Slot>
      );
    }

    return (
      <motion.button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        whileTap={{ scale: 0.98 }}
        whileHover={{ y: -1 }}
        transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
        {...(props as HTMLMotionProps<'button'>)}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading...</span>
          </>
        ) : (
          children
        )}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
