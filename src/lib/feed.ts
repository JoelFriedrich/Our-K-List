import { supabase } from './supabase';

/**
 * Helper to insert feed events with a fresh session check.
 * This is critical for OAuth users where the session might not be immediately
 * available in React state after a redirect.
 */
export const insertFeedEvent = async (
  eventType: string,
  showId: string,
  userShowId: string,
  metadata: any
) => {
  try {
    // Always get fresh session - never rely on cached user for writes
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user?.id) {
      console.error('No active session for feed event insert');
      return;
    }
    
    const { error } = await supabase.from('Feed_events').insert({
      user_id: session.user.id,
      event_type: eventType,
      show_id: showId,
      user_show_id: userShowId,
      metadata
    });

    if (error) throw error;
    
    console.log(`Feed event '${eventType}' inserted for user:`, session.user.id);
  } catch (err) {
    console.error('Feed event insert failed:', err);
  }
};
