'use client';

import type React from 'react';
import { cn } from '@/lib/utils/helpers';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export default function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-3xl border border-ink/10 bg-white/75 p-6 shadow-[0_18px_46px_rgba(58,48,96,0.12)] backdrop-blur-sm',
        className
      )}
      {...props}
    />
  );
}
