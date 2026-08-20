import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Show, UserShow } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Human-readable label for a ShowStatus (e.g. 'want_to_watch' -> 'want to watch'). */
export const formatStatus = (status: string) => status.replace(/_/g, ' ');

/** Builds a synthetic UserShow for read-only views of shows not in a user's list. */
export const makeViewOnlyUserShow = (
  userId: string,
  showId: string,
  show: Show | undefined,
  overrides: Partial<UserShow> = {}
): UserShow => ({
  id: '',
  user_id: userId,
  show_id: showId,
  user_rating: 0,
  comments: '',
  status: 'watched',
  added_at: '',
  is_spoiler: false,
  show,
  ...overrides
});
