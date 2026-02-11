'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils/helpers';

interface HelpPopoverProps {
  text: string;
  label: string;
  align?: 'left' | 'right';
  className?: string;
}

export default function HelpPopover({ text, label, align = 'right', className }: HelpPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [supportsHover, setSupportsHover] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    const updateHoverSupport = () => setSupportsHover(mediaQuery.matches);

    updateHoverSupport();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateHoverSupport);
      return () => mediaQuery.removeEventListener('change', updateHoverSupport);
    }

    mediaQuery.addListener(updateHoverSupport);
    return () => mediaQuery.removeListener(updateHoverSupport);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen]);

  return (
    <div
      ref={wrapperRef}
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => {
        if (supportsHover) {
          setIsOpen(true);
        }
      }}
      onMouseLeave={() => {
        if (supportsHover) {
          setIsOpen(false);
        }
      }}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={isOpen}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-ink/25 bg-white/92 text-[11px] font-semibold text-ink/70 shadow-sm transition hover:border-ink/45 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lagoon/45"
        onClick={() => setIsOpen((prev) => !prev)}
        onFocus={() => setIsOpen(true)}
      >
        ?
      </button>
      {isOpen ? (
        <div
          role="tooltip"
          className={cn(
            'absolute top-full z-20 mt-2 w-64 rounded-2xl border border-ink/15 bg-white/95 p-3 text-xs leading-relaxed text-ink/80 shadow-[0_14px_32px_rgba(15,21,36,0.2)]',
            align === 'left' ? 'left-0' : 'right-0'
          )}
        >
          {text}
        </div>
      ) : null}
    </div>
  );
}
