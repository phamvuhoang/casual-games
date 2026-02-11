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
          'inline-flex items-center justify-center rounded-full font-semibold tracking-[0.01em] transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lagoon/45 disabled:pointer-events-none disabled:opacity-50',
          variant === 'solid' &&
            'bg-gradient-to-r from-[#7f76d1] via-[#7499cd] to-[#70a7b6] text-white shadow-[0_14px_28px_rgba(86,76,146,0.33)] hover:-translate-y-0.5 hover:brightness-105',
          variant === 'outline' &&
            'border border-ink/20 bg-white/72 text-ink shadow-[0_8px_20px_rgba(38,42,66,0.08)] hover:bg-white',
          variant === 'ghost' && 'bg-transparent text-ink/80 hover:bg-white/60 hover:text-ink',
          size === 'sm' && 'px-4 py-2 text-xs',
          size === 'md' && 'px-5 py-2.5 text-sm',
          size === 'lg' && 'px-7 py-3 text-base',
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export default Button;
