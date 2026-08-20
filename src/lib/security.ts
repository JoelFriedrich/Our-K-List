const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INVITE_CODE_PATTERN = /^[a-z0-9]{4,32}$/i;

export const MAX_SEARCH_LENGTH = 100;
export const MAX_DISPLAY_NAME_LENGTH = 50;
export const MAX_COMMENT_LENGTH = 2000;
export const MAX_URL_LENGTH = 2048;

export const isUuid = (value: string | null | undefined): boolean =>
  typeof value === 'string' && UUID_PATTERN.test(value);

export const isInviteCode = (value: string | null | undefined): boolean =>
  typeof value === 'string' && INVITE_CODE_PATTERN.test(value);

/** Cryptographically random invite code (~93 bits of entropy). */
export const generateInviteCode = (): string => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('');
};

/**
 * Strips characters that are significant to PostgREST filter parsing (`,`, `.`,
 * `:`, `(`, `)`, quotes) or to SQL LIKE matching (`%`, `_`, `\`, and `*` which
 * PostgREST maps to `%`) so a search term cannot alter the query it is used in.
 */
export const sanitizeSearchTerm = (term: string): string =>
  term
    .slice(0, MAX_SEARCH_LENGTH)
    .replace(/[%_*\\,.:()"']/g, '')
    .trim();

/** Only allows http(s) URLs, blocking javascript:, data: and other schemes. */
export const sanitizeImageUrl = (url: string): string | null => {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_URL_LENGTH) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
};
