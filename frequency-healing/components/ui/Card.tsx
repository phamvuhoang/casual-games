'use client';

import type React from 'react';
import { cn } from '@/lib/utils/helpers';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export default function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn('rounded-3xl border border-black/5 bg-white/70 p-6 shadow-sm', className)}
      {...props}
    />
  );
}
