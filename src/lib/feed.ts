import { supabase } from './supabase';
import { logError } from './errors';

interface FeedEventMetadata {
  [key: string]: unknown;
}

export type FeedEventResult =
  | { ok: true }
  | { ok: false; error: unknown };

/**
 * Helper to insert feed events with a fresh session check.
 * This is critical for OAuth users where the session might not be immediately
 * available in React state after a redirect.
 */
export const insertFeedEvent = async (
  eventType: string,
  showId: string,
  userShowId: string,
  metadata: FeedEventMetadata
): Promise<FeedEventResult> => {
  try {
    // Always get fresh session - never rely on cached user for writes
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user?.id) {
      const error = new Error('No active session for feed event insert');
      logError('Feed event insert', error);
      return { ok: false, error };
    }
    
    const { error } = await supabase.from('Feed_events').insert({
      user_id: session.user.id,
      event_type: eventType,
      show_id: showId,
      user_show_id: userShowId,
      metadata
    });

    if (error) throw error;
    return { ok: true };
  } catch (err) {
    logError('Feed event insert', err);
    return { ok: false, error: err };
  }
};
