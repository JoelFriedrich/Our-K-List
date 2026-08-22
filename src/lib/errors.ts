import { toast } from 'react-hot-toast';

const FALLBACK_ERROR_MESSAGE = 'Something went wrong. Please try again.';

interface PostgrestErrorShape {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isPostgrestErrorShape = (value: unknown): value is PostgrestErrorShape =>
  isRecord(value) &&
  typeof value.message === 'string' &&
  value.message.trim().length > 0;

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (isPostgrestErrorShape(error)) {
    const additions = [error.details, error.hint]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .filter((value, index, values) => values.indexOf(value) === index)
      .filter(value => !error.message.includes(value));
    return [error.message, ...additions].join(' — ');
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return FALLBACK_ERROR_MESSAGE;
};

export const logError = (context: string, error: unknown): void => {
  console.error(`[${context}]`, error);
};

export const reportError = (context: string, error: unknown, userMessage?: string): void => {
  logError(context, error);
  toast.error(userMessage ?? getErrorMessage(error));
};

export const isNotFoundError = (error: unknown): boolean =>
  isRecord(error) && error.code === 'PGRST116';
