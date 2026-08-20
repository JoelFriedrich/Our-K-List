import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface ModalShellProps {
  onClose: () => void;
  /** Overrides for the fullscreen wrapper (z-index, padding). */
  wrapperClassName?: string;
  /** Overrides for the click-to-close backdrop. */
  backdropClassName?: string;
  /** Overrides for the animated content panel (max width, layout). */
  panelClassName?: string;
  children: React.ReactNode;
}

export default function ModalShell({
  onClose,
  wrapperClassName,
  backdropClassName,
  panelClassName,
  children
}: ModalShellProps) {
  return (
    <div className={cn('fixed inset-0 z-[70] flex items-center justify-center p-4', wrapperClassName)}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className={cn('absolute inset-0 bg-black/90 backdrop-blur-sm', backdropClassName)}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className={cn('relative w-full bg-card-bg rounded-xl overflow-hidden shadow-2xl border border-zinc-800', panelClassName)}
      >
        {children}
      </motion.div>
    </div>
  );
}
