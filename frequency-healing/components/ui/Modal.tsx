'use client';

import type React from 'react';
import { useEffect } from 'react';
import { cn } from '@/lib/utils/helpers';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export default function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (open) {
      window.addEventListener('keydown', handleEscape);
    }

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
      <div className={cn('glass-panel w-full max-w-lg rounded-3xl p-6 shadow-[0_24px_64px_rgba(10,12,24,0.36)]')}>
        <div className="flex items-center justify-between">
          {title ? <h3 className="text-xl font-semibold">{title}</h3> : null}
          <button
            onClick={onClose}
            className="rounded-full border border-ink/12 px-3 py-1 text-sm text-ink/70 hover:bg-white/70"
          >
            Close
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
