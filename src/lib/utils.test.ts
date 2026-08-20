import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('joins plain class names', () => {
    expect(cn('px-2', 'text-sm')).toBe('px-2 text-sm');
  });

  it('ignores falsy values', () => {
    expect(cn('px-2', false, null, undefined, '', 'text-sm')).toBe('px-2 text-sm');
  });

  it('supports conditional objects and arrays', () => {
    expect(cn(['flex', { hidden: false, 'gap-2': true }])).toBe('flex gap-2');
  });

  it('lets the last conflicting tailwind class win', () => {
    expect(cn('px-2 px-4')).toBe('px-4');
    expect(cn('text-sm', 'text-lg')).toBe('text-lg');
  });

  it('keeps non-conflicting tailwind classes', () => {
    expect(cn('px-2 py-1', 'text-white')).toBe('px-2 py-1 text-white');
  });

  it('returns an empty string with no inputs', () => {
    expect(cn()).toBe('');
  });
});
