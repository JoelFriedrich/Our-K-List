import { supabase } from './supabase';
import { Award, Profile, UserShow } from '../types';

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

export const fetchProfile = async (userId: string): Promise<Profile | null> => {
  const { data, error } = await supabase
    .from('Profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
  return data;
};

/** PostgREST `or` filter matching a friendship row between two users in either direction. */
export const friendshipBetweenFilter = (userIdA: string, userIdB: string) =>
  `and(user_id.eq.${userIdA},friend_id.eq.${userIdB}),and(user_id.eq.${userIdB},friend_id.eq.${userIdA})`;

export const fetchAcceptedFriendIds = async (userId: string): Promise<string[]> => {
  const { data } = await supabase
    .from('Friendships')
    .select('user_id, friend_id')
    .eq('status', 'accepted')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

  return data?.map(f => (f.user_id === userId ? f.friend_id : f.user_id)) ?? [];
};

export const fetchAwardsForUser = async (userId: string): Promise<Award[]> => {
  const { data, error } = await supabase
    .from('Awards')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Awards fetch error:', error);
  }
  return data ?? [];
};

export const attachAwards = (userShows: UserShow[] | null, awards: Award[]): UserShow[] =>
  userShows?.map(us => ({
    ...us,
    awards: awards.filter(a => a.show_id === us.show_id)
  })) ?? [];
