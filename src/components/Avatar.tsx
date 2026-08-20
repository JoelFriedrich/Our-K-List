import React from 'react';
import { cn } from '../lib/utils';

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  /** Custom fallback content; defaults to the first character of `name` (or 'U'). */
  fallback?: React.ReactNode;
  /** Classes applied to both the image and the fallback (size, borders, etc.). */
  className?: string;
  /** Classes applied only to the fallback (text size, font, etc.). */
  fallbackClassName?: string;
}

export default function Avatar({ src, name, fallback, className, fallbackClassName }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={name || 'User'}
        className={cn('rounded-full object-cover', className)}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div className={cn('rounded-full bg-zinc-800 flex items-center justify-center', className, fallbackClassName)}>
      {fallback ?? (name?.charAt(0) || 'U')}
    </div>
  );
}
