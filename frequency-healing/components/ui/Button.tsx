'use client';

import { Slot } from '@radix-ui/react-slot';
import * as React from 'react';
import { cn } from '@/lib/utils/helpers';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'solid' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  asChild?: boolean;
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'solid', size = 'md', asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-full font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 disabled:pointer-events-none disabled:opacity-50',
          variant === 'solid' && 'bg-ink text-white shadow-glow hover:-translate-y-0.5',
          variant === 'outline' && 'border border-ink/20 bg-white/70 text-ink hover:bg-white',
          variant === 'ghost' && 'bg-transparent text-ink hover:bg-black/5',
          size === 'sm' && 'px-4 py-2 text-xs',
          size === 'md' && 'px-5 py-3 text-sm',
          size === 'lg' && 'px-7 py-4 text-base',
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export default Button;
